import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Invoice } from "./types";

/** Bucket público con el logo de la empresa. */
export const BRANDING_BUCKET = "branding";
/** Bucket privado con los XML firmado y autorizado de cada factura. */
export const INVOICES_BUCKET = "facturas";

export function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function logoPublicUrl(supabase: SupabaseClient, path: string): string {
  return path ? supabase.storage.from(BRANDING_BUCKET).getPublicUrl(path).data.publicUrl : "";
}

/**
 * Logo como data URL PNG o JPG para el PDF de la factura ("" si no hay o es otro formato).
 * Admite el logo antiguo guardado como data URL en company_settings.
 */
export async function logoForPdf(
  supabase: SupabaseClient,
  settings: { logo_path: string; logo_url: string },
): Promise<string> {
  if (!settings.logo_path) return /^data:image\/(png|jpeg);base64,/.test(settings.logo_url) ? settings.logo_url : "";
  const type = /\.png$/.test(settings.logo_path) ? "image/png" : /\.jpg$/.test(settings.logo_path) ? "image/jpeg" : "";
  if (!type) return "";
  const { data, error } = await supabase.storage.from(BRANDING_BUCKET).download(settings.logo_path);
  // Sin logo el PDF muestra el nombre comercial: no se bloquea la factura por esto.
  if (error || !data) return "";
  return `data:${type};base64,${Buffer.from(await data.arrayBuffer()).toString("base64")}`;
}

const signedXmlPath = (invoiceId: string, accessKey: string) => `${invoiceId}/${accessKey}-firmada.xml`;
const authorizedXmlPath = (invoiceId: string, accessKey: string) => `${invoiceId}/${accessKey}-autorizada.xml`;

function isDuplicate(error: unknown): boolean {
  const e = error as { statusCode?: string; code?: string } | null;
  return e?.statusCode === "409" || e?.code === "ResourceAlreadyExists";
}

async function downloadText(supabase: SupabaseClient, path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(INVOICES_BUCKET).download(path);
  if (error || !data) throw new Error("No se pudo leer el XML de la factura en Storage.");
  return data.text();
}

/** Guarda (o reemplaza) el XML firmado y devuelve su ruta. */
export async function storeSignedXml(
  supabase: SupabaseClient,
  invoiceId: string,
  accessKey: string,
  xml: string,
): Promise<string> {
  const path = signedXmlPath(invoiceId, accessKey);
  const { error } = await supabase.storage
    .from(INVOICES_BUCKET)
    .upload(path, Buffer.from(xml, "utf8"), { contentType: "application/xml", upsert: true });
  if (error) throw new Error("No se pudo guardar el XML firmado en Storage.");
  return path;
}

/**
 * Guarda el XML autorizado, que no se puede reemplazar. Si ya existe (un intento anterior
 * lo subió pero no llegó a registrarlo en la factura), conserva el guardado y usa su hash.
 */
export async function storeAuthorizedXml(
  supabase: SupabaseClient,
  invoiceId: string,
  accessKey: string,
  xml: string,
): Promise<{ path: string; sha256: string }> {
  const path = authorizedXmlPath(invoiceId, accessKey);
  const { error } = await supabase.storage
    .from(INVOICES_BUCKET)
    .upload(path, Buffer.from(xml, "utf8"), { contentType: "application/xml", upsert: false });
  if (!error) return { path, sha256: sha256(xml) };
  if (!isDuplicate(error)) throw new Error("No se pudo guardar el XML autorizado en Storage.");
  return { path, sha256: sha256(await downloadText(supabase, path)) };
}

type InvoiceXmlFields = Pick<
  Invoice,
  "authorized_xml" | "authorized_xml_path" | "authorized_xml_sha256" | "signed_xml" | "signed_xml_path"
>;

export function hasAuthorizedXml(invoice: InvoiceXmlFields): boolean {
  return Boolean(invoice.authorized_xml_path || invoice.authorized_xml);
}

export function hasInvoiceXml(invoice: InvoiceXmlFields): boolean {
  return Boolean(hasAuthorizedXml(invoice) || invoice.signed_xml_path || invoice.signed_xml);
}

/** XML autorizado de la factura, comprobado contra el hash registrado; null si no tiene. */
export async function loadAuthorizedXml(supabase: SupabaseClient, invoice: InvoiceXmlFields): Promise<string | null> {
  if (!invoice.authorized_xml_path) return invoice.authorized_xml;
  const xml = await downloadText(supabase, invoice.authorized_xml_path);
  if (sha256(xml) !== invoice.authorized_xml_sha256) {
    throw new Error("El XML autorizado guardado no coincide con el registrado en la factura.");
  }
  return xml;
}

/** XML autorizado o, si aún no lo hay, el firmado; null si la factura no tiene ninguno. */
export async function loadInvoiceXml(supabase: SupabaseClient, invoice: InvoiceXmlFields): Promise<string | null> {
  if (hasAuthorizedXml(invoice)) return loadAuthorizedXml(supabase, invoice);
  if (invoice.signed_xml_path) return downloadText(supabase, invoice.signed_xml_path);
  return invoice.signed_xml;
}
