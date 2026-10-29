"use server";

import { revalidatePath } from "next/cache";
import { adminClient } from "@/lib/admin/auth";
import { todayInEcuador } from "@/lib/admin/format";
import { actionError, number, text, upsertClient, type ActionResult } from "@/lib/admin/server";
import type { Invoice, InvoiceStatus } from "@/lib/admin/types";
import { identificationTypes, paymentMethods, vatRates } from "@/lib/sri/catalogs";
import { emitInvoice as emit, refreshAuthorization, type EmissionOutcome } from "@/lib/sri/emit";
import { parseRecipients, type EmailOutcome } from "@/lib/sri/invoice-email";
import { maybeSendOnAuthorization, sendInvoiceEmail } from "@/lib/sri/invoice-email-send";
import { computeInvoiceTotals } from "@/lib/sri/totals";

const EDITABLE: InvoiceStatus[] = ["borrador", "devuelta", "no_autorizada"];

export type InvoiceInput = Pick<Invoice, "buyer" | "items" | "payments" | "additional_info" | "issue_date">;

function sanitize(input: InvoiceInput): InvoiceInput {
  const buyer = input.buyer ?? ({} as Invoice["buyer"]);
  return {
    buyer: {
      identificationType: identificationTypes.some((t) => t.code === buyer.identificationType)
        ? buyer.identificationType
        : "05",
      identification: text(buyer.identification, 20),
      name: text(buyer.name, 300),
      address: text(buyer.address, 300),
      email: text(buyer.email, 200),
      phone: text(buyer.phone, 50),
    },
    items: (Array.isArray(input.items) ? input.items : []).slice(0, 300).map((it) => ({
      code: text(it.code, 25),
      description: text(it.description, 300),
      quantity: number(it.quantity, 0, 1_000_000),
      unitPrice: number(it.unitPrice, 0, 100_000_000),
      discount: number(it.discount, 0, 100_000_000),
      vatCode: vatRates.some((v) => v.code === it.vatCode) ? it.vatCode : "4",
    })),
    payments: (Array.isArray(input.payments) ? input.payments : []).slice(0, 10).map((p) => ({
      method: paymentMethods.some((m) => m.code === p.method) ? p.method : "20",
      amount: number(p.amount, 0, 100_000_000),
      term: p.term ? Math.round(number(p.term, 0, 3650)) : null,
      timeUnit: text(p.timeUnit, 10),
    })),
    additional_info: (Array.isArray(input.additional_info) ? input.additional_info : [])
      .slice(0, 15)
      .map((f) => ({ name: text(f.name, 300), value: text(f.value, 300) })),
    issue_date: /^\d{4}-\d{2}-\d{2}$/.test(input.issue_date) ? input.issue_date : todayInEcuador(),
  };
}

export async function saveInvoice(id: string | null, input: InvoiceInput): Promise<ActionResult> {
  try {
    const supabase = await adminClient();
    const row = sanitize(input);
    const totals = computeInvoiceTotals(row.items);
    const client_id = row.buyer.identificationType === "07"
      ? null
      : await upsertClient(supabase, row.buyer, row.buyer.identificationType);

    const values = {
      ...row,
      client_id,
      subtotal: totals.subtotal,
      discount_total: totals.discount,
      vat_total: totals.vat,
      total: totals.total,
    };

    if (id) {
      const { data: current, error: loadError } = await supabase
        .from("invoices")
        .select("status, access_key")
        .eq("id", id)
        .single();
      if (loadError) throw loadError;
      if (!EDITABLE.includes(current.status)) throw new Error("Esta factura ya no se puede modificar.");

      // La fecha forma parte de la clave de acceso: no cambia una vez numerada.
      const patch = current.access_key ? { ...values, issue_date: undefined } : values;
      const { error } = await supabase.from("invoices").update(patch).eq("id", id);
      if (error) throw error;
      revalidatePath("/admin/facturas");
      return { ok: true, id };
    }

    const { data, error } = await supabase.from("invoices").insert(values).select("id").single();
    if (error) throw error;
    revalidatePath("/admin/facturas");
    return { ok: true, id: data.id };
  } catch (error) {
    return actionError(error);
  }
}

/** Resultado de emitir o consultar, con el envío automático por correo si la factura quedó autorizada. */
export type AuthorizationResult = EmissionOutcome & { email?: EmailOutcome };

export async function emitInvoice(id: string): Promise<ActionResult<AuthorizationResult>> {
  try {
    const supabase = await adminClient();
    const outcome = await emit(supabase, id);
    // Un fallo de correo nunca cambia el resultado de la emisión.
    const email = outcome.status === "autorizada" ? await maybeSendOnAuthorization(supabase, id) : null;
    revalidatePath("/admin/facturas");
    return { ok: true, ...outcome, ...(email ? { email } : {}) };
  } catch (error) {
    revalidatePath("/admin/facturas");
    return actionError(error);
  }
}

export async function checkAuthorization(id: string): Promise<ActionResult<AuthorizationResult>> {
  try {
    const supabase = await adminClient();
    const outcome = await refreshAuthorization(supabase, id);
    const email = outcome.status === "autorizada" ? await maybeSendOnAuthorization(supabase, id) : null;
    revalidatePath("/admin/facturas");
    return { ok: true, ...outcome, ...(email ? { email } : {}) };
  } catch (error) {
    return actionError(error);
  }
}

/** Reenvía la factura autorizada a hasta 3 destinatarios. */
export async function resendInvoiceEmail(
  id: string,
  recipients: string,
): Promise<ActionResult<{ to: string[]; rejected: string[] }>> {
  try {
    const supabase = await adminClient();
    const to = parseRecipients(typeof recipients === "string" ? recipients : "");
    const result = await sendInvoiceEmail(supabase, id, to);
    revalidatePath(`/admin/facturas/${id}`);
    return { ok: true, ...result };
  } catch (error) {
    revalidatePath(`/admin/facturas/${id}`);
    return actionError(error);
  }
}

/** Marca como anulada una factura autorizada. La anulación oficial se solicita en el portal del SRI. */
export async function markInvoiceVoided(id: string): Promise<ActionResult<object>> {
  try {
    const supabase = await adminClient();
    const { data, error } = await supabase
      .from("invoices")
      .update({ status: "anulada" })
      .eq("id", id)
      .eq("status", "autorizada")
      .select("id");
    if (error) throw error;
    if (!data.length) throw new Error("Solo se pueden anular facturas autorizadas.");
    revalidatePath("/admin/facturas");
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteInvoice(id: string): Promise<ActionResult<object>> {
  try {
    const supabase = await adminClient();
    const { error } = await supabase.from("invoices").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/admin/facturas");
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}
