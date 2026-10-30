#!/usr/bin/env node
// Pasa a Supabase Storage el logo y los XML de facturas que aún están guardados en la base
// (company_settings.logo_data_url, invoices.signed_xml e invoices.authorized_xml) y vacía
// esas columnas. Se puede ejecutar varias veces: solo procesa lo que falta.
//
//   npm run storage:migrate
//
// Requiere la migración 20261030140000_storage_logo_xml.sql aplicada, y
// NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY (clave secreta o service_role) en .env.local.

import { createClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "node:crypto";

const BRANDING_BUCKET = "branding";
const INVOICES_BUCKET = "facturas";
const PAGE_SIZE = 50;
const LOGO_EXTENSIONS = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg" };

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secretKey = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  if (!url || !secretKey) {
    fail("Define NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY en .env.local.");
  }
  return createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const sha256 = (text) => createHash("sha256").update(text, "utf8").digest("hex");
const isDuplicate = (error) => error?.statusCode === "409" || error?.code === "ResourceAlreadyExists";

async function migrateLogo(supabase) {
  const { data, error } = await supabase
    .from("company_settings")
    .select("logo_data_url, logo_path")
    .eq("id", 1)
    .single();
  if (error) fail(`No se pudo leer la configuración: ${error.message}`);
  if (!data.logo_data_url || data.logo_path) return console.log("· Logo: nada que migrar.");

  const match = /^data:(image\/(?:png|jpeg|webp|svg\+xml));base64,(.+)$/s.exec(data.logo_data_url);
  if (!match) fail("El logo guardado no es un data URL de imagen válido.");
  const [, contentType, base64] = match;
  const path = `logo/${randomUUID()}.${LOGO_EXTENSIONS[contentType]}`;

  const { error: uploadError } = await supabase.storage
    .from(BRANDING_BUCKET)
    .upload(path, Buffer.from(base64, "base64"), { contentType, cacheControl: "31536000", upsert: false });
  if (uploadError) fail(`No se pudo subir el logo: ${uploadError.message}`);

  const { error: updateError } = await supabase
    .from("company_settings")
    .update({ logo_path: path, logo_data_url: "" })
    .eq("id", 1);
  if (updateError) fail(`No se pudo registrar el logo: ${updateError.message}`);
  console.log(`✔ Logo movido a ${BRANDING_BUCKET}/${path}.`);
}

async function upload(supabase, path, xml, upsert) {
  const { error } = await supabase.storage
    .from(INVOICES_BUCKET)
    .upload(path, Buffer.from(xml, "utf8"), { contentType: "application/xml", upsert });
  if (!error) return;
  if (!upsert && isDuplicate(error)) {
    // Una ejecución anterior lo subió: solo se acepta si es el mismo XML.
    const { data, error: downloadError } = await supabase.storage.from(INVOICES_BUCKET).download(path);
    if (!downloadError && sha256(await data.text()) === sha256(xml)) return;
    throw new Error(`${path} ya existe en Storage con otro contenido.`);
  }
  throw new Error(`No se pudo subir ${path}: ${error.message}`);
}

async function migrateInvoice(supabase, invoice) {
  const patch = {};
  if (invoice.signed_xml && !invoice.signed_xml_path) {
    const path = `${invoice.id}/${invoice.access_key}-firmada.xml`;
    await upload(supabase, path, invoice.signed_xml, true);
    Object.assign(patch, { signed_xml_path: path, signed_xml: null });
  }
  if (invoice.authorized_xml && !invoice.authorized_xml_path) {
    const path = `${invoice.id}/${invoice.access_key}-autorizada.xml`;
    await upload(supabase, path, invoice.authorized_xml, false);
    // El trigger de facturas autorizadas solo admite este cambio si el hash coincide.
    Object.assign(patch, {
      authorized_xml_path: path,
      authorized_xml_sha256: sha256(invoice.authorized_xml),
      authorized_xml: null,
    });
  }
  const { error } = await supabase.from("invoices").update(patch).eq("id", invoice.id);
  if (error) throw new Error(`No se pudo actualizar la factura: ${error.message}`);
}

async function migrateInvoices(supabase) {
  let migrated = 0;
  const failed = new Set();
  for (;;) {
    let query = supabase
      .from("invoices")
      .select("id, access_key, signed_xml, signed_xml_path, authorized_xml, authorized_xml_path")
      .not("access_key", "is", null)
      .or("and(signed_xml.not.is.null,signed_xml_path.is.null),and(authorized_xml.not.is.null,authorized_xml_path.is.null)")
      .order("id")
      .limit(PAGE_SIZE);
    if (failed.size) query = query.not("id", "in", `(${[...failed].join(",")})`);
    const { data, error } = await query;
    if (error) fail(`No se pudieron leer las facturas: ${error.message}`);
    if (!data.length) break;

    for (const invoice of data) {
      try {
        await migrateInvoice(supabase, invoice);
        migrated++;
      } catch (err) {
        failed.add(invoice.id);
        console.error(`✖ Factura ${invoice.access_key}: ${err.message}`);
      }
    }
  }
  console.log(`✔ Facturas migradas: ${migrated}.${failed.size ? ` Con error: ${failed.size}.` : ""}`);
  if (failed.size) process.exitCode = 1;
}

const supabase = getAdminClient();
await migrateLogo(supabase);
await migrateInvoices(supabase);
