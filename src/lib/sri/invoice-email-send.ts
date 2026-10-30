import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCompanySettings } from "@/lib/admin/server";
import type { CompanySettings, Invoice } from "@/lib/admin/types";
import {
  autoSendRecipients,
  buildInvoiceEmail,
  parseRecipients,
  readSmtpConfig,
  rejectedRecipientsMessage,
  sendViaSmtp,
  type DeliveryResult,
  type EmailOutcome,
} from "./invoice-email";
import { claimAutoSend, confirmAutoSend, releaseAutoSend } from "./invoice-email-claim";
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

/**
 * Genera el RIDE en PDF y envía la factura autorizada por SMTP. No escribe en la base.
 * Devuelve qué destinatarios aceptó el servidor; lanza si no aceptó ninguno.
 */
async function deliverInvoiceEmail(invoice: Invoice, settings: CompanySettings, to: string[]): Promise<DeliveryResult> {
  const smtp = readSmtpConfig();
  if ("missing" in smtp || !settings.invoice_email_from.trim()) {
    throw new Error("Configura el correo de facturación (servidor SMTP y remitente) en Configuración.");
  }
  const optional = (value: string) => (value.trim() ? parseRecipients(value, 1) : undefined);

  const data = buildRideData(invoice, settings);
  const pdf = await renderRidePdf(data, settings.logo_data_url);
  const email = buildInvoiceEmail({ data, settings, pdf, authorizedXml: invoice.authorized_xml ?? "" });
  return sendViaSmtp(
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
 * Reenvío manual de una factura autorizada. Registra solo los destinatarios aceptados y, si
 * el servidor rechazó alguno, lo deja anotado en la factura para reenviar. Lanza el error con
 * un mensaje apto para mostrar al usuario si no se aceptó ninguno.
 */
export async function sendInvoiceEmail(
  supabase: SupabaseClient,
  invoiceId: string,
  to: string[],
): Promise<{ to: string[]; rejected: string[] }> {
  const invoice = await loadInvoice(supabase, invoiceId);
  if (invoice.status !== "autorizada" || !invoice.authorized_xml) {
    throw new Error("Solo se pueden enviar facturas autorizadas.");
  }

  let delivery: DeliveryResult;
  try {
    delivery = await deliverInvoiceEmail(invoice, await getCompanySettings(supabase), to);
  } catch (error) {
    const message = errorMessage(error);
    await supabase.from("invoices").update({ last_email_error: message }).eq("id", invoice.id);
    throw new Error(message);
  }
  // El correo ya salió: si falla este registro no se informa como error de envío.
  await supabase
    .from("invoices")
    .update({
      last_emailed_at: new Date().toISOString(),
      last_emailed_to: delivery.accepted.join(", "),
      last_email_error: delivery.rejected.length ? rejectedRecipientsMessage(delivery.rejected) : null,
    })
    .eq("id", invoice.id);
  return { to: delivery.accepted, rejected: delivery.rejected };
}

/**
 * Envío automático al autorizar: toda factura autorizada se envía al correo del comprador.
 * Devuelve null si no correspondía enviar (p. ej. el comprador no tiene correo). Nunca lanza.
 * Reserva la factura antes de enviar (ver invoice-email-claim.ts) para que dos peticiones
 * simultáneas no manden el correo dos veces; si el envío falla (también por falta de
 * configuración SMTP o remitente), libera la reserva y deja el error visible en la factura.
 */
export async function maybeSendOnAuthorization(supabase: SupabaseClient, invoiceId: string): Promise<EmailOutcome | null> {
  let claimedAt: string | null = null;
  try {
    const invoice = await loadInvoice(supabase, invoiceId);
    const to = autoSendRecipients(invoice);
    if (!to) return null;

    claimedAt = await claimAutoSend(supabase, invoiceId, to);
    if (!claimedAt) return null; // Otra petición ya lo envió o lo está enviando.

    const delivery = await deliverInvoiceEmail(invoice, await getCompanySettings(supabase), to);
    await confirmAutoSend(supabase, invoiceId, claimedAt, delivery.accepted, delivery.rejected);
    return { sent: true, to: delivery.accepted, rejected: delivery.rejected };
  } catch (error) {
    const message = errorMessage(error);
    if (claimedAt) await releaseAutoSend(supabase, invoiceId, claimedAt, message);
    return { sent: false, error: message };
  }
}
