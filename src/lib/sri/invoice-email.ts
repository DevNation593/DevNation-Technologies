import "server-only";
import { formatMoney } from "@/lib/admin/format";
import type { CompanySettings, Invoice } from "@/lib/admin/types";
import type { RideData } from "./ride";

/** Sin espacios ni caracteres que permitan inyectar cabeceras o nombres ("<", ",", ";"…). */
const EMAIL_PATTERN = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]+$/;
const MAX_EMAIL_LENGTH = 254;
const RESEND_URL = "https://api.resend.com/emails";
const RESEND_TIMEOUT_MS = 15_000;
const MAX_ERROR_LENGTH = 300;

export interface EmailAttachment {
  filename: string;
  /** Contenido en base64. */
  content: string;
}

export interface ResendPayload {
  from: string;
  to: string[];
  bcc?: string[];
  reply_to?: string[];
  subject: string;
  html: string;
  attachments: EmailAttachment[];
}

export type EmailOutcome = { sent: true; to: string[] } | { sent: false; error: string };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Separa por coma o punto y coma, valida cada dirección y quita duplicados (sin distinguir mayúsculas). */
export function parseRecipients(value: string, max = 3): string[] {
  const recipients: string[] = [];
  for (const raw of value.split(/[,;]/)) {
    const email = raw.trim();
    if (!email) continue;
    if (email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
      throw new Error(`Correo no válido: ${email.replace(/\s+/g, " ").slice(0, 100)}`);
    }
    if (!recipients.some((r) => r.toLowerCase() === email.toLowerCase())) recipients.push(email);
  }
  if (recipients.length === 0) throw new Error("Escribe al menos un correo válido.");
  if (recipients.length > max) throw new Error(max === 1 ? "Escribe un solo correo." : `Máximo ${max} destinatarios.`);
  return recipients;
}

const MAX_SENDER_LENGTH = 200;
/** "correo" o "Nombre <correo>"; el nombre no admite <, >, comillas, comas, punto y coma ni saltos de línea. */
const SENDER_PATTERN = /^(?:([^<>",;\r\n]+?)\s*<([^<>]+)>|([^<>]+))$/;

/**
 * Valida el remitente del correo de facturación y lo devuelve normalizado ("" si está vacío).
 * La dirección debe ser exactamente un correo válido, para que Resend no lo rechace al enviar.
 */
export function parseSender(value: string): string {
  const sender = value.trim();
  if (!sender) return "";
  const error = new Error("Escribe el remitente, p. ej. DevNation Facturación <facturacion@devnation.tech>.");
  const match = sender.length <= MAX_SENDER_LENGTH ? SENDER_PATTERN.exec(sender) : null;
  if (!match) throw error;
  const address = match[2] ?? match[3];
  try {
    if (parseRecipients(address, 1)[0] !== address) throw error;
  } catch {
    throw error;
  }
  return sender;
}

/** Destinatarios del envío automático al autorizar, o null si no corresponde enviar. Nunca lanza. */
export function autoSendRecipients(invoice: Invoice, settings: CompanySettings, hasApiKey: boolean): string[] | null {
  if (!settings.invoice_email_enabled || !hasApiKey || !settings.invoice_email_from.trim()) return null;
  if (invoice.status !== "autorizada" || !invoice.authorized_xml || invoice.last_emailed_at) return null;
  try {
    return parseRecipients(invoice.buyer.email ?? "");
  } catch {
    return null;
  }
}

export function buildInvoiceEmail(input: {
  data: RideData;
  settings: CompanySettings;
  pdf: Buffer;
  authorizedXml: string;
}): { subject: string; html: string; attachments: EmailAttachment[] } {
  const { data, settings, pdf, authorizedXml } = input;
  const issuer = settings.nombre_comercial || settings.razon_social;
  const contact = [`RUC ${settings.ruc}`, settings.email, settings.telefono].filter(Boolean).join(" · ");

  const html =
    '<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a;line-height:1.5">' +
    `<p>Estimado/a ${escapeHtml(data.buyer.name)}:</p>` +
    `<p>Adjuntamos la factura electrónica <strong>${escapeHtml(data.number)}</strong> emitida por ` +
    `${escapeHtml(issuer)} el ${escapeHtml(data.issueDate)}, por un total de ` +
    `<strong>${escapeHtml(formatMoney(data.total))}</strong>.</p>` +
    "<p>Encontrarás adjuntos el RIDE en PDF y el comprobante electrónico en XML autorizado por el SRI.<br>" +
    `Clave de acceso: <code>${escapeHtml(data.accessKey)}</code></p>` +
    '<p style="color:#64748b;font-size:12px">' +
    `${escapeHtml(settings.razon_social)} · ${escapeHtml(contact)}</p>` +
    "</div>";

  return {
    subject: `Factura ${data.number} de ${issuer}`,
    html,
    attachments: [
      { filename: `${data.fileBase}.pdf`, content: pdf.toString("base64") },
      { filename: `${data.fileBase}.xml`, content: Buffer.from(authorizedXml, "utf8").toString("base64") },
    ],
  };
}

/** Envía el correo con la API HTTP de Resend. Los errores nunca incluyen la API key. */
export async function postToResend(
  payload: ResendPayload,
  options: { apiKey: string; idempotencyKey?: string },
): Promise<{ id: string }> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${options.apiKey}`,
    "Content-Type": "application/json",
  };
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;

  let response: Response;
  try {
    response = await fetch(RESEND_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
    });
  } catch {
    throw new Error("No se pudo conectar con el servicio de correo.");
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (body as { message?: unknown } | null)?.message;
    throw new Error(
      typeof message === "string" && message.trim()
        ? message.trim().slice(0, MAX_ERROR_LENGTH)
        : `El servicio de correo respondió con un error (${response.status}).`,
    );
  }
  return { id: String((body as { id?: unknown } | null)?.id ?? "") };
}
