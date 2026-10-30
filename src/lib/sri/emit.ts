import "server-only";
import { randomInt } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { todayInEcuador } from "@/lib/admin/format";
import { getCompanySettings, nextNumber } from "@/lib/admin/server";
import type { Invoice, InvoiceStatus, SriMessage } from "@/lib/admin/types";
import { buildAccessKey } from "./access-key";
import { INVOICE_DOC_CODE } from "./catalogs";
import { getSigningCertificate } from "./certificate";
import { buildAuthorizedXml, queryAuthorization, sendToReception, type AuthorizationResult } from "./client";
import { assertInvoiceSchema } from "./schema";
import { signInvoiceXml } from "./sign";
import { computeInvoiceTotals } from "./totals";
import { validateInvoice, validateIssuer } from "./validate";
import { buildInvoiceXml } from "./xml";

export interface EmissionOutcome {
  status: InvoiceStatus;
  messages: SriMessage[];
}

/** Códigos de recepción que indican que el SRI ya tiene el comprobante. */
const ALREADY_RECEIVED = new Set(["43", "45", "70"]);
const EDITABLE: InvoiceStatus[] = ["borrador", "devuelta", "no_autorizada"];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function loadInvoice(supabase: SupabaseClient, id: string): Promise<Invoice> {
  const { data, error } = await supabase.from("invoices").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Invoice;
}

async function update(supabase: SupabaseClient, id: string, patch: Partial<Invoice>) {
  const { error } = await supabase.from("invoices").update(patch).eq("id", id);
  if (error) throw error;
}

/** Asigna secuencial y clave de acceso (o los conserva si el SRI devolvió el comprobante). */
async function ensureNumbering(supabase: SupabaseClient, invoice: Invoice): Promise<Invoice> {
  if (invoice.access_key && invoice.status !== "no_autorizada") return invoice;

  const settings = await getCompanySettings(supabase);
  const environment = settings.ambiente;
  const seq = await nextNumber(supabase, `factura:${environment}:${settings.estab}-${settings.pto_emi}`);
  const secuencial = String(seq).padStart(9, "0");
  // Un comprobante NO AUTORIZADO se reemite con número y fecha nuevos.
  const issueDate = invoice.status === "no_autorizada" ? todayInEcuador() : invoice.issue_date;
  const accessKey = buildAccessKey({
    issueDate,
    docCode: INVOICE_DOC_CODE,
    ruc: settings.ruc,
    environment,
    estab: settings.estab,
    ptoEmi: settings.pto_emi,
    secuencial,
    numericCode: String(randomInt(0, 100_000_000)).padStart(8, "0"),
  });

  const { data, error } = await supabase
    .from("invoices")
    .update({
      ambiente: environment,
      estab: settings.estab,
      pto_emi: settings.pto_emi,
      secuencial,
      access_key: accessKey,
      issue_date: issueDate,
      status: "borrador",
    })
    .eq("id", invoice.id)
    .eq("updated_at", invoice.updated_at)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("La factura cambió mientras se numeraba. Vuelve a intentarlo.");
  return data as Invoice;
}

async function applyAuthorization(
  supabase: SupabaseClient,
  invoice: Invoice,
  result: AuthorizationResult,
  receptionMessages: SriMessage[],
): Promise<EmissionOutcome> {
  const messages = [...receptionMessages, ...result.messages];

  if (result.status === "AUTORIZADO") {
    await update(supabase, invoice.id, {
      status: "autorizada",
      authorization_number: result.authorizationNumber ?? invoice.access_key,
      authorized_at: result.authorizedAt ?? new Date().toISOString(),
      authorized_xml: buildAuthorizedXml(result),
      sri_messages: messages,
    });
    return { status: "autorizada", messages };
  }

  if (result.status === "NO AUTORIZADO") {
    await update(supabase, invoice.id, { status: "no_autorizada", sri_messages: messages });
    return { status: "no_autorizada", messages };
  }

  await update(supabase, invoice.id, { status: "enviada", sri_messages: messages });
  return { status: "enviada", messages };
}

/** Consulta la autorización varias veces: el SRI suele tardar unos segundos. */
async function pollAuthorization(accessKey: string, environment: 1 | 2, attempts = 4) {
  let result: AuthorizationResult = { status: "SIN RESPUESTA", messages: [] };
  for (let i = 0; i < attempts; i++) {
    await wait(i === 0 ? 1500 : 2500);
    result = await queryAuthorization(accessKey, environment);
    if (result.status === "AUTORIZADO" || result.status === "NO AUTORIZADO") break;
  }
  return result;
}

export async function emitInvoice(supabase: SupabaseClient, id: string): Promise<EmissionOutcome> {
  let invoice = await loadInvoice(supabase, id);
  if (!EDITABLE.includes(invoice.status)) {
    throw new Error("Esta factura ya fue enviada al SRI.");
  }

  const settings = await getCompanySettings(supabase);
  const errors = [...validateIssuer(settings), ...validateInvoice(invoice, todayInEcuador())];
  if (errors.length) throw new Error(errors.join(" "));

  // Se valida la firma antes de reservar un secuencial.
  const certificate = await getSigningCertificate();
  if (certificate.validTo.getTime() < Date.now()) {
    throw new Error("La firma electrónica está caducada.");
  }

  // También la estructura del XML: si aún no hay numeración se usan valores
  // provisionales con el mismo formato que exige el XSD.
  await assertInvoiceSchema(
    buildInvoiceXml({
      invoice,
      settings,
      environment: invoice.ambiente ?? settings.ambiente,
      estab: invoice.estab ?? settings.estab,
      ptoEmi: invoice.pto_emi ?? settings.pto_emi,
      secuencial: invoice.secuencial ?? "000000001",
      accessKey: invoice.access_key ?? "0".repeat(49),
    }),
  );

  invoice = await ensureNumbering(supabase, invoice);
  const environment = invoice.ambiente as 1 | 2;
  const totals = computeInvoiceTotals(invoice.items);

  const xml = buildInvoiceXml({
    invoice,
    settings,
    environment,
    estab: invoice.estab!,
    ptoEmi: invoice.pto_emi!,
    secuencial: invoice.secuencial!,
    accessKey: invoice.access_key!,
  });
  await assertInvoiceSchema(xml);
  const signedXml = signInvoiceXml(xml, certificate);

  await update(supabase, id, {
    signed_xml: signedXml,
    subtotal: totals.subtotal,
    discount_total: totals.discount,
    vat_total: totals.vat,
    total: totals.total,
  });

  const reception = await sendToReception(signedXml, environment);
  const alreadyReceived = reception.messages.some((m) => ALREADY_RECEIVED.has(m.identificador));

  if (reception.status === "DEVUELTA" && !alreadyReceived) {
    await update(supabase, id, { status: "devuelta", sri_messages: reception.messages });
    return { status: "devuelta", messages: reception.messages };
  }

  await update(supabase, id, { status: "enviada", sri_messages: reception.messages });
  const authorization = await pollAuthorization(invoice.access_key!, environment);
  return applyAuthorization(supabase, invoice, authorization, alreadyReceived ? [] : reception.messages);
}

export async function refreshAuthorization(supabase: SupabaseClient, id: string): Promise<EmissionOutcome> {
  const invoice = await loadInvoice(supabase, id);
  if (!invoice.access_key || !invoice.ambiente) throw new Error("La factura todavía no se ha emitido.");
  if (invoice.status === "autorizada" || invoice.status === "anulada") {
    return { status: invoice.status, messages: invoice.sri_messages };
  }
  const result = await queryAuthorization(invoice.access_key, invoice.ambiente);
  if (result.status === "SIN RESPUESTA" && invoice.status !== "enviada") {
    return { status: invoice.status, messages: invoice.sri_messages };
  }
  return applyAuthorization(supabase, invoice, result, []);
}
