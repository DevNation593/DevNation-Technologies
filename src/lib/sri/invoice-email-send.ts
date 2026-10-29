import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCompanySettings } from "@/lib/admin/server";
import type { Invoice } from "@/lib/admin/types";
import { autoSendRecipients, buildInvoiceEmail, parseRecipients, postToResend, type EmailOutcome } from "./invoice-email";
import { buildRideData } from "./ride";
import { renderRidePdf } from "./ride-pdf";

async function loadInvoice(supabase: SupabaseClient, id: string): Promise<Invoice> {
  const { data, error } = await supabase.from("invoices").select("*").eq("id", id).single();
  if (error || !data) throw new Error("No se encontró la factura.");
  return data as Invoice;
}

function resendApiKey(): string {
  return process.env.RESEND_API_KEY?.trim() ?? "";
}

/**
 * Envía la factura autorizada (RIDE en PDF + XML) y deja registrado el resultado
 * en la factura. Lanza el error con un mensaje apto para mostrar al usuario.
 */
export async function sendInvoiceEmail(
  supabase: SupabaseClient,
  invoiceId: string,
  options: { to?: string[]; trigger: "auto" | "manual" },
): Promise<{ to: string[] }> {
  const invoice = await loadInvoice(supabase, invoiceId);
  if (invoice.status !== "autorizada" || !invoice.authorized_xml) {
    throw new Error("Solo se pueden enviar facturas autorizadas.");
  }

  try {
    const settings = await getCompanySettings(supabase);
    const apiKey = resendApiKey();
    if (!apiKey || !settings.invoice_email_from.trim()) {
      throw new Error("Configura el correo de facturación en Configuración.");
    }
    const to = options.to ?? parseRecipients(invoice.buyer.email ?? "");
    const optional = (value: string) => (value.trim() ? parseRecipients(value, 1) : undefined);

    const data = buildRideData(invoice, settings);
    const pdf = await renderRidePdf(data, settings.logo_data_url);
    const email = buildInvoiceEmail({ data, settings, pdf, authorizedXml: invoice.authorized_xml });
    await postToResend(
      {
        from: settings.invoice_email_from.trim(),
        to,
        bcc: optional(settings.invoice_email_bcc),
        reply_to: optional(settings.invoice_email_reply_to),
        ...email,
      },
      // Evita el correo duplicado si dos pestañas confirman la autorización a la vez.
      { apiKey, idempotencyKey: options.trigger === "auto" ? `factura-${invoice.id}-auto` : undefined },
    );

    await supabase
      .from("invoices")
      .update({ last_emailed_at: new Date().toISOString(), last_emailed_to: to.join(", "), last_email_error: null })
      .eq("id", invoice.id);
    return { to };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo enviar el correo.";
    await supabase.from("invoices").update({ last_email_error: message }).eq("id", invoice.id);
    throw new Error(message);
  }
}

/** Envío automático al autorizar: devuelve null si no correspondía enviar. Nunca lanza. */
export async function maybeSendOnAuthorization(
  supabase: SupabaseClient,
  invoiceId: string,
): Promise<EmailOutcome | null> {
  try {
    const invoice = await loadInvoice(supabase, invoiceId);
    const settings = await getCompanySettings(supabase);
    const to = autoSendRecipients(invoice, settings, Boolean(resendApiKey()));
    if (!to) return null;
    return { sent: true, ...(await sendInvoiceEmail(supabase, invoiceId, { to, trigger: "auto" })) };
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message : "No se pudo enviar el correo." };
  }
}
