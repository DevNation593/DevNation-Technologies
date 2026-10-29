import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCompanySettings } from "@/lib/admin/server";
import type { CompanySettings, Invoice } from "@/lib/admin/types";
import {
  autoSendRecipients,
  buildInvoiceEmail,
  parseRecipients,
  readSmtpConfig,
  sendViaSmtp,
  type EmailOutcome,
} from "./invoice-email";
import { buildRideData } from "./ride";
import { renderRidePdf } from "./ride-pdf";

async function loadInvoice(supabase: SupabaseClient, id: string): Promise<Invoice> {
  const { data, error } = await supabase.from("invoices").select("*").eq("id", id).single();
  if (error || !data) throw new Error("No se encontró la factura.");
  return data as Invoice;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "No se pudo enviar el correo.";
}

/** Genera el RIDE en PDF y envía la factura autorizada por SMTP. No escribe en la base. */
async function deliverInvoiceEmail(invoice: Invoice, settings: CompanySettings, to: string[]): Promise<void> {
  const smtp = readSmtpConfig();
  if ("missing" in smtp || !settings.invoice_email_from.trim()) {
    throw new Error("Configura el correo de facturación (servidor SMTP y remitente) en Configuración.");
  }
  const optional = (value: string) => (value.trim() ? parseRecipients(value, 1) : undefined);

  const data = buildRideData(invoice, settings);
  const pdf = await renderRidePdf(data, settings.logo_data_url);
  const email = buildInvoiceEmail({ data, settings, pdf, authorizedXml: invoice.authorized_xml ?? "" });
  await sendViaSmtp(
    {
      from: settings.invoice_email_from.trim(),
      to,
      bcc: optional(settings.invoice_email_bcc),
      replyTo: optional(settings.invoice_email_reply_to),
      ...email,
    },
    smtp.config,
  );
}

/**
 * Reenvío manual de una factura autorizada. Deja registrado el resultado en la
 * factura y lanza el error con un mensaje apto para mostrar al usuario.
 */
export async function sendInvoiceEmail(supabase: SupabaseClient, invoiceId: string, to: string[]): Promise<{ to: string[] }> {
  const invoice = await loadInvoice(supabase, invoiceId);
  if (invoice.status !== "autorizada" || !invoice.authorized_xml) {
    throw new Error("Solo se pueden enviar facturas autorizadas.");
  }

  try {
    await deliverInvoiceEmail(invoice, await getCompanySettings(supabase), to);
  } catch (error) {
    const message = errorMessage(error);
    await supabase.from("invoices").update({ last_email_error: message }).eq("id", invoice.id);
    throw new Error(message);
  }
  // El correo ya salió: si falla este registro no se informa como error de envío.
  await supabase
    .from("invoices")
    .update({ last_emailed_at: new Date().toISOString(), last_emailed_to: to.join(", "), last_email_error: null })
    .eq("id", invoice.id);
  return { to };
}

/**
 * Envío automático al autorizar: devuelve null si no correspondía enviar. Nunca lanza.
 * Antes de enviar reserva la factura (marca last_emailed_at solo si estaba vacío) para que
 * dos peticiones simultáneas no manden el correo dos veces; si el envío falla, se libera.
 */
export async function maybeSendOnAuthorization(supabase: SupabaseClient, invoiceId: string): Promise<EmailOutcome | null> {
  let claimed = false;
  try {
    const invoice = await loadInvoice(supabase, invoiceId);
    const settings = await getCompanySettings(supabase);
    const to = autoSendRecipients(invoice, settings, "config" in readSmtpConfig());
    if (!to) return null;

    const { data: claim, error: claimError } = await supabase
      .from("invoices")
      .update({ last_emailed_at: new Date().toISOString(), last_emailed_to: to.join(", "), last_email_error: null })
      .eq("id", invoiceId)
      .is("last_emailed_at", null)
      .select("id");
    if (claimError) throw new Error("No se pudo registrar el envío del correo.");
    if (!claim?.length) return null; // Otra petición ya lo envió o lo está enviando.
    claimed = true;

    await deliverInvoiceEmail(invoice, settings, to);
    return { sent: true, to };
  } catch (error) {
    const message = errorMessage(error);
    if (claimed) {
      await supabase
        .from("invoices")
        .update({ last_emailed_at: null, last_emailed_to: null, last_email_error: message })
        .eq("id", invoiceId);
    }
    return { sent: false, error: message };
  }
}
