import "server-only";
import nodemailer from "nodemailer";
import { formatMoney } from "@/lib/admin/format";
import type { CompanySettings, Invoice } from "@/lib/admin/types";
import { hasAuthorizedXml } from "@/lib/admin/storage";
import type { RideData } from "./ride";

/** Sin espacios ni caracteres que permitan inyectar cabeceras o nombres ("<", ",", ";"…). */
const EMAIL_PATTERN = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]+$/;
const MAX_EMAIL_LENGTH = 254;
const MAX_ERROR_LENGTH = 300;
const SMTP_CONNECTION_TIMEOUT_MS = 10_000;
const SMTP_SOCKET_TIMEOUT_MS = 20_000;

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface OutgoingEmail {
  from: string;
  to: string[];
  bcc?: string[];
  replyTo?: string[];
  subject: string;
  html: string;
  attachments: EmailAttachment[];
}

export interface SmtpConfig {
  host: string;
  port: number;
  /** TLS directo en el puerto 465. */
  secure: boolean;
  /**
   * En los demás puertos (587, 25) STARTTLS es obligatorio: si el servidor no lo ofrece no se envía nada,
   * para que la contraseña nunca viaje en claro. Solo se exime a un servidor en la propia máquina.
   */
  requireTls: boolean;
  user: string;
  password: string;
}

/** Resultado de un envío: qué destinatarios "to" aceptó el servidor y cuáles rechazó. */
export interface DeliveryResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
}

export type EmailOutcome = { sent: true; to: string[]; rejected: string[] } | { sent: false; error: string };

type SmtpAddress = string | { address?: string };

/**
 * Reparte los destinatarios "to" entre aceptados y rechazados según la respuesta del
 * servidor. La copia oculta no cuenta, y un destinatario sin confirmación se da por rechazado.
 */
export function splitDelivery(
  to: string[],
  info: { accepted?: SmtpAddress[]; rejected?: SmtpAddress[] },
): { accepted: string[]; rejected: string[] } {
  const normalize = (a: SmtpAddress) => (typeof a === "string" ? a : (a.address ?? "")).trim().toLowerCase();
  const accepted = new Set((info.accepted ?? []).map(normalize));
  return {
    accepted: to.filter((email) => accepted.has(email.toLowerCase())),
    rejected: to.filter((email) => !accepted.has(email.toLowerCase())),
  };
}

/** Texto para registrar en la factura los destinatarios que hay que volver a intentar. */
export function rejectedRecipientsMessage(rejected: string[]): string {
  return `El servidor SMTP rechazó: ${rejected.join(", ")}. Reenvía la factura a esas direcciones.`;
}

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
 * La dirección debe ser exactamente un correo válido para que el servidor SMTP la acepte.
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

/**
 * Lee la configuración SMTP de las variables del servidor. Usuario y contraseña son
 * opcionales (servidores locales sin autenticación), pero deben venir juntos.
 */
export function readSmtpConfig(
  env: Record<string, string | undefined> = process.env,
): { config: SmtpConfig } | { missing: string[] } {
  const host = env.SMTP_HOST?.trim() ?? "";
  const port = Number(env.SMTP_PORT?.trim());
  const user = env.SMTP_USER?.trim() ?? "";
  const password = env.SMTP_PASSWORD ?? "";

  const missing: string[] = [];
  if (!host) missing.push("SMTP_HOST");
  if (!Number.isInteger(port) || port < 1 || port > 65535) missing.push("SMTP_PORT");
  if (password && !user) missing.push("SMTP_USER");
  if (user && !password) missing.push("SMTP_PASSWORD");
  if (missing.length) return { missing };
  const secure = port === 465;
  const loopback = ["localhost", "127.0.0.1", "::1"].includes(host.toLowerCase());
  return { config: { host, port, secure, requireTls: !secure && !loopback, user, password } };
}

/** Mensaje apto para el usuario a partir de un error de nodemailer; nunca incluye credenciales. */
export function smtpErrorMessage(error: unknown): string {
  const { code, response } = (error ?? {}) as { code?: unknown; response?: unknown };
  const serverText = typeof response === "string" ? response.trim() : "";
  const truncate = (text: string) => text.slice(0, MAX_ERROR_LENGTH);

  switch (code) {
    case "EAUTH":
      return "El servidor SMTP rechazó el usuario o la contraseña.";
    case "ECONNECTION":
    case "ESOCKET":
    case "ETIMEDOUT":
    case "EDNS":
    case "ECONNREFUSED":
      return "No se pudo conectar con el servidor de correo.";
    case "ETLS":
      return "No se pudo establecer una conexión segura con el servidor de correo.";
    case "EENVELOPE":
      return serverText
        ? truncate(`El servidor SMTP rechazó el remitente o los destinatarios: ${serverText}`)
        : "El servidor SMTP rechazó el remitente o los destinatarios.";
  }
  return serverText ? truncate(`El servidor SMTP respondió: ${serverText}`) : "No se pudo enviar el correo.";
}

/**
 * Destinatarios del envío automático al autorizar, o null si no corresponde enviar: la factura no
 * está autorizada, ya se envió o el comprador no tiene correo. Lanza si su correo no es válido.
 */
export function autoSendRecipients(invoice: Invoice): string[] | null {
  if (invoice.status !== "autorizada" || !hasAuthorizedXml(invoice) || invoice.last_emailed_at) return null;
  const email = invoice.buyer.email?.trim() ?? "";
  return email ? parseRecipients(email) : null;
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
      { filename: `${data.fileBase}.pdf`, content: pdf, contentType: "application/pdf" },
      { filename: `${data.fileBase}.xml`, content: Buffer.from(authorizedXml, "utf8"), contentType: "application/xml" },
    ],
  };
}

/**
 * Envía el correo por el servidor SMTP configurado y devuelve qué destinatarios "to" se
 * aceptaron. Nodemailer resuelve si el servidor acepta al menos un destinatario (aunque sea
 * solo la copia oculta), así que si no se aceptó ninguno de "to" se lanza un error.
 */
export async function sendViaSmtp(email: OutgoingEmail, config: SmtpConfig): Promise<DeliveryResult> {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: config.requireTls,
    auth: config.user ? { user: config.user, pass: config.password } : undefined,
    connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
    greetingTimeout: SMTP_CONNECTION_TIMEOUT_MS,
    socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
  });
  let info: { messageId?: string; accepted?: SmtpAddress[]; rejected?: SmtpAddress[] };
  try {
    info = await transport.sendMail({
      from: email.from,
      to: email.to,
      bcc: email.bcc,
      replyTo: email.replyTo,
      subject: email.subject,
      html: email.html,
      attachments: email.attachments,
    });
  } catch (error) {
    throw new Error(smtpErrorMessage(error));
  } finally {
    transport.close();
  }

  const { accepted, rejected } = splitDelivery(email.to, info);
  if (accepted.length === 0) {
    throw new Error(`El servidor SMTP rechazó a todos los destinatarios: ${rejected.join(", ")}.`.slice(0, MAX_ERROR_LENGTH));
  }
  return { messageId: String(info.messageId ?? ""), accepted, rejected };
}
