"use server";

import { revalidatePath } from "next/cache";
import { adminClient } from "@/lib/admin/auth";
import { actionError, text, type ActionResult } from "@/lib/admin/server";
import type { CompanySettings } from "@/lib/admin/types";
import { regimes } from "@/lib/sri/catalogs";

const MAX_LOGO_LENGTH = 400_000;

export async function saveSettings(input: CompanySettings): Promise<ActionResult<object>> {
  try {
    const supabase = await adminClient();
    const ruc = text(input.ruc, 13);
    if (ruc && !/^[0-9]{13}$/.test(ruc)) throw new Error("El RUC debe tener 13 dígitos.");
    if (!/^[0-9]{3}$/.test(input.estab) || !/^[0-9]{3}$/.test(input.pto_emi)) {
      throw new Error("Establecimiento y punto de emisión deben tener 3 dígitos (p. ej. 001).");
    }
    const logo = typeof input.logo_data_url === "string" ? input.logo_data_url : "";
    if (logo && (!/^data:image\/(png|jpeg|webp|svg\+xml);base64,/.test(logo) || logo.length > MAX_LOGO_LENGTH)) {
      throw new Error("El logo debe ser PNG, JPG, WEBP o SVG de máximo 300 KB.");
    }

    const { error } = await supabase
      .from("company_settings")
      .update({
        ruc,
        razon_social: text(input.razon_social, 300),
        nombre_comercial: text(input.nombre_comercial, 300),
        dir_matriz: text(input.dir_matriz, 300),
        dir_establecimiento: text(input.dir_establecimiento, 300),
        estab: input.estab,
        pto_emi: input.pto_emi,
        ambiente: input.ambiente === 2 ? 2 : 1,
        obligado_contabilidad: Boolean(input.obligado_contabilidad),
        contribuyente_especial: text(input.contribuyente_especial, 13),
        agente_retencion: text(input.agente_retencion, 8),
        regimen: regimes.some((r) => r.code === input.regimen) ? input.regimen : "GENERAL",
        representante_legal: text(input.representante_legal, 200),
        email: text(input.email, 200),
        telefono: text(input.telefono, 50),
        ciudad: text(input.ciudad, 200),
        logo_data_url: logo,
      })
      .eq("id", 1);
    if (error) throw error;
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

/**
 * Fija el próximo secuencial de facturas para el ambiente, establecimiento y
 * punto de emisión indicados (por ejemplo, al migrar desde otro sistema).
 */
export async function setNextInvoiceSequential(
  environment: 1 | 2,
  estab: string,
  ptoEmi: string,
  next: number,
): Promise<ActionResult<object>> {
  try {
    const supabase = await adminClient();
    if (!Number.isInteger(next) || next < 1 || next > 999_999_999) {
      throw new Error("El secuencial debe ser un número entre 1 y 999999999.");
    }
    const key = `factura:${environment}:${estab}-${ptoEmi}`;

    const { count, error: countError } = await supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("ambiente", environment)
      .eq("estab", estab)
      .eq("pto_emi", ptoEmi)
      .gte("secuencial", String(next).padStart(9, "0"));
    if (countError) throw countError;
    if (count) throw new Error("Ya existen facturas con ese secuencial o uno mayor.");

    const { error } = await supabase
      .from("document_sequences")
      .upsert({ key, last_value: next - 1, updated_at: new Date().toISOString() });
    if (error) throw error;
    revalidatePath("/admin/configuracion");
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}
