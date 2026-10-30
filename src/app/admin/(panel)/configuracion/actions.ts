"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { adminClient, requireAdmin } from "@/lib/admin/auth";
import { dateInEcuador, formatDate } from "@/lib/admin/format";
import { actionError, text, type ActionResult } from "@/lib/admin/server";
import { MAX_LOGO_BYTES } from "@/lib/admin/logo";
import { BRANDING_BUCKET, logoPublicUrl } from "@/lib/admin/storage";
import type { CompanySettings } from "@/lib/admin/types";
import { regimes } from "@/lib/sri/catalogs";
import { encryptSecret } from "@/lib/sri/crypto";
import { parseRecipients, parseSender } from "@/lib/sri/invoice-email";
import { parseP12 } from "@/lib/sri/p12";

const MAX_P12_BYTES = 50 * 1024;

/** Formatos de logo admitidos: extensión en Storage y comprobación del contenido real del archivo. */
const LOGO_TYPES: Record<string, { ext: string; matches: (bytes: Buffer) => boolean }> = {
  "image/png": { ext: "png", matches: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  "image/jpeg": { ext: "jpg", matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/webp": { ext: "webp", matches: (b) => b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP" },
  "image/svg+xml": { ext: "svg", matches: (b) => /<svg[\s>]/i.test(b.toString("utf8", 0, 4096)) },
};
const MAX_P12_PASSWORD_LENGTH = 200;
const MAX_EMAIL_SETTING_LENGTH = 200;

/** Valida un correo opcional (responder a, copia oculta); devuelve "" si está vacío. */
function optionalEmail(value: string): string {
  const email = text(value, MAX_EMAIL_SETTING_LENGTH);
  return email ? parseRecipients(email, 1)[0] : "";
}

export async function saveInvoiceEmailSettings(input: {
  from: string;
  replyTo: string;
  bcc: string;
}): Promise<ActionResult<object>> {
  try {
    const supabase = await adminClient();
    const from = parseSender(typeof input.from === "string" ? input.from : "");
    if (!from) {
      throw new Error("Escribe el remitente, p. ej. DevNation Facturación <facturacion@devnation.tech>.");
    }

    const { error } = await supabase
      .from("company_settings")
      .update({
        invoice_email_from: from,
        invoice_email_reply_to: optionalEmail(input.replyTo),
        invoice_email_bcc: optionalEmail(input.bcc),
      })
      .eq("id", 1);
    if (error) throw error;
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function saveSettings(input: CompanySettings): Promise<ActionResult<object>> {
  try {
    const supabase = await adminClient();
    const ruc = text(input.ruc, 13);
    if (ruc && !/^[0-9]{13}$/.test(ruc)) throw new Error("El RUC debe tener 13 dígitos.");
    if (!/^[0-9]{3}$/.test(input.estab) || !/^[0-9]{3}$/.test(input.pto_emi)) {
      throw new Error("Establecimiento y punto de emisión deben tener 3 dígitos (p. ej. 001).");
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
      })
      .eq("id", 1);
    if (error) throw error;
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

/** Sube el logo al bucket branding y reemplaza el anterior. */
export async function uploadLogo(formData: FormData): Promise<ActionResult<{ url: string; path: string }>> {
  try {
    const supabase = await adminClient();
    const file = formData.get("logo");
    if (!(file instanceof File) || file.size === 0) throw new Error("Selecciona la imagen del logo.");
    const type = LOGO_TYPES[file.type];
    const bytes = Buffer.from(await file.arrayBuffer());
    if (!type || file.size > MAX_LOGO_BYTES || !type.matches(bytes)) {
      throw new Error("El logo debe ser PNG, JPG, WEBP o SVG de máximo 1 MB.");
    }

    const { data: current, error: loadError } = await supabase
      .from("company_settings")
      .select("logo_path")
      .eq("id", 1)
      .single();
    if (loadError) throw loadError;

    const path = `logo/${randomUUID()}.${type.ext}`;
    const storage = supabase.storage.from(BRANDING_BUCKET);
    const { error: uploadError } = await storage.upload(path, bytes, {
      contentType: file.type,
      // Cada logo tiene una ruta nueva, así que se puede guardar en caché sin límite.
      cacheControl: "31536000",
      upsert: false,
    });
    if (uploadError) throw new Error("No se pudo subir el logo.");

    const { error } = await supabase
      .from("company_settings")
      .update({ logo_path: path, logo_data_url: "" })
      .eq("id", 1);
    if (error) {
      await storage.remove([path]);
      throw error;
    }
    // Si falla el borrado del logo anterior solo queda un archivo sin usar.
    if (current.logo_path) await storage.remove([current.logo_path]);
    revalidatePath("/admin", "layout");
    return { ok: true, path, url: logoPublicUrl(supabase, path) };
  } catch (error) {
    return actionError(error);
  }
}

export async function removeLogo(): Promise<ActionResult<object>> {
  try {
    const supabase = await adminClient();
    const { data: current, error: loadError } = await supabase
      .from("company_settings")
      .select("logo_path")
      .eq("id", 1)
      .single();
    if (loadError) throw loadError;
    const { error } = await supabase
      .from("company_settings")
      .update({ logo_path: "", logo_data_url: "" })
      .eq("id", 1);
    if (error) throw error;
    if (current.logo_path) await supabase.storage.from(BRANDING_BUCKET).remove([current.logo_path]);
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

/**
 * Guarda la firma electrónica (.p12 y contraseña) cifradas con SRI_ENCRYPTION_KEY.
 * Ni el archivo ni la contraseña vuelven al navegador.
 */
export async function uploadCertificate(
  formData: FormData,
): Promise<ActionResult<{ subject: string; validTo: string }>> {
  try {
    const supabase = await adminClient();
    const admin = await requireAdmin();

    const file = formData.get("p12");
    if (!(file instanceof File) || file.size === 0) {
      throw new Error("Selecciona el archivo .p12 de tu firma electrónica.");
    }
    if (!/\.(p12|pfx)$/i.test(file.name) || file.size > MAX_P12_BYTES) {
      throw new Error("El archivo debe ser .p12 o .pfx de máximo 50 KB.");
    }
    // La contraseña se usa tal cual: puede empezar o terminar con espacios.
    const rawPassword = formData.get("password");
    const password = typeof rawPassword === "string" ? rawPassword : "";
    if (!password || password.length > MAX_P12_PASSWORD_LENGTH) {
      throw new Error("Escribe la contraseña de la firma (máximo 200 caracteres).");
    }

    const der = Buffer.from(await file.arrayBuffer());
    const certificate = parseP12(der, password);
    const validTo = certificate.validTo.toISOString();
    if (certificate.validTo.getTime() < Date.now()) {
      throw new Error(`La firma electrónica ya caducó el ${formatDate(dateInEcuador(validTo))}. Sube una vigente.`);
    }

    const { error } = await supabase.from("sri_certificates").upsert(
      {
        id: 1,
        p12_encrypted: encryptSecret(der, "sri_certificates.p12"),
        password_encrypted: encryptSecret(Buffer.from(password, "utf8"), "sri_certificates.password"),
        subject: certificate.subject,
        issuer: certificate.issuer,
        serial_number: certificate.serialNumber,
        valid_from: certificate.validFrom.toISOString(),
        valid_to: validTo,
        uploaded_at: new Date().toISOString(),
        uploaded_by: admin.userId,
      },
      { onConflict: "id" },
    );
    if (error) throw new Error("No se pudo guardar la firma electrónica.");
    revalidatePath("/admin", "layout");
    return { ok: true, subject: certificate.subject, validTo };
  } catch (error) {
    return actionError(error);
  }
}

export async function removeCertificate(): Promise<ActionResult<object>> {
  try {
    const supabase = await adminClient();
    const { error } = await supabase.from("sri_certificates").delete().eq("id", 1);
    if (error) throw new Error("No se pudo quitar la firma electrónica.");
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}
