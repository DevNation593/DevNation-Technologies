"use server";

import { revalidatePath } from "next/cache";
import { adminClient } from "@/lib/admin/auth";
import { computeQuoteTotals } from "@/lib/admin/quote";
import {
  actionError,
  getCompanySettings,
  nextNumber,
  number,
  text,
  upsertClient,
  type ActionResult,
} from "@/lib/admin/server";
import type { ClientSnapshot, ContractData, Quote, QuoteItem, QuoteStatus } from "@/lib/admin/types";
import { toNumber } from "@/lib/admin/types";
import { todayInEcuador } from "@/lib/admin/format";
import { FINAL_CONSUMER_ID } from "@/lib/sri/catalogs";
import { inferIdentificationType } from "@/lib/sri/identification";
import { computeInvoiceTotals, round2 } from "@/lib/sri/totals";
import type { Invoice } from "@/lib/admin/types";
import { defaultContractData } from "@/lib/admin/contract-template";

const QUOTE_STATUSES: QuoteStatus[] = ["borrador", "enviada", "aceptada", "rechazada", "facturada"];

export interface QuoteInput {
  status: QuoteStatus;
  issue_date: string;
  valid_days: number;
  currency: "USD" | "EUR";
  client: ClientSnapshot;
  items: QuoteItem[];
  tax_rate: number;
  discount_rate: number;
  payment_terms: string;
  delivery_time: string;
  notes: string;
}

function sanitize(input: QuoteInput) {
  const items = (Array.isArray(input.items) ? input.items : [])
    .map((it) => ({
      description: text(it.description, 500),
      qty: number(it.qty, 0, 1_000_000),
      price: number(it.price, 0, 100_000_000),
    }))
    .filter((it) => it.description || it.price > 0)
    .slice(0, 200);
  const taxRate = number(input.tax_rate, 0, 100);
  const discountRate = number(input.discount_rate, 0, 100);
  const totals = computeQuoteTotals(items, discountRate, taxRate);

  return {
    status: QUOTE_STATUSES.includes(input.status) ? input.status : "borrador",
    issue_date: /^\d{4}-\d{2}-\d{2}$/.test(input.issue_date) ? input.issue_date : todayInEcuador(),
    valid_days: Math.round(number(input.valid_days, 1, 365)),
    currency: input.currency === "EUR" ? "EUR" : "USD",
    client: {
      name: text(input.client?.name, 300),
      identification: text(input.client?.identification, 20),
      email: text(input.client?.email, 200),
      phone: text(input.client?.phone, 50),
      address: text(input.client?.address, 300),
    },
    items,
    tax_rate: taxRate,
    discount_rate: discountRate,
    payment_terms: text(input.payment_terms, 500),
    delivery_time: text(input.delivery_time, 500),
    notes: text(input.notes, 4000),
    subtotal: totals.subtotal,
    total: totals.total,
  };
}

export async function saveQuote(id: string | null, input: QuoteInput): Promise<ActionResult<{ id: string; number: string }>> {
  try {
    const supabase = await adminClient();
    const row = sanitize(input);
    const client_id = await upsertClient(supabase, row.client);

    if (id) {
      const { data, error } = await supabase
        .from("quotes")
        .update({ ...row, client_id })
        .eq("id", id)
        .select("id, number")
        .single();
      if (error) throw error;
      revalidatePath("/admin/cotizaciones");
      return { ok: true, id: data.id, number: data.number };
    }

    const year = row.issue_date.slice(0, 4);
    const seq = await nextNumber(supabase, `cotizacion:${year}`);
    const quoteNumber = `DN-${year}-${String(seq).padStart(4, "0")}`;
    const { data, error } = await supabase
      .from("quotes")
      .insert({ ...row, client_id, number: quoteNumber })
      .select("id, number")
      .single();
    if (error) throw error;
    revalidatePath("/admin/cotizaciones");
    return { ok: true, id: data.id, number: data.number };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteQuote(id: string): Promise<ActionResult<object>> {
  try {
    const supabase = await adminClient();
    const { error } = await supabase.from("quotes").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/admin/cotizaciones");
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

async function loadQuote(id: string) {
  const supabase = await adminClient();
  const { data, error } = await supabase.from("quotes").select("*").eq("id", id).single();
  if (error) throw error;
  return { supabase, quote: data as Quote };
}

function vatCodeFor(rate: number): string {
  if (rate === 0) return "0";
  if (rate === 5) return "5";
  return "4";
}

/** Crea un borrador de factura con los ítems, descuento e IVA de la cotización. */
export async function createInvoiceFromQuote(id: string): Promise<ActionResult> {
  try {
    const { supabase, quote } = await loadQuote(id);
    const discountRate = toNumber(quote.discount_rate);
    const vatCode = vatCodeFor(toNumber(quote.tax_rate));
    const identification = quote.client.identification?.trim() || FINAL_CONSUMER_ID;
    const identificationType = inferIdentificationType(identification);

    const items: Invoice["items"] = quote.items.map((it, index) => ({
      code: `SERV${String(index + 1).padStart(2, "0")}`,
      description: it.description,
      quantity: toNumber(it.qty),
      unitPrice: toNumber(it.price),
      discount: round2((toNumber(it.qty) * toNumber(it.price) * discountRate) / 100),
      vatCode,
    }));

    const additional_info = [
      { name: "Email", value: quote.client.email },
      { name: "Teléfono", value: quote.client.phone },
      { name: "Cotización", value: quote.number },
    ].filter((f) => f.value);
    const totals = computeInvoiceTotals(items);

    const { data, error } = await supabase
      .from("invoices")
      .insert({
        quote_id: quote.id,
        client_id: quote.client_id,
        buyer: {
          identificationType,
          identification,
          name: quote.client.name || "CONSUMIDOR FINAL",
          address: quote.client.address ?? "",
          email: quote.client.email ?? "",
          phone: quote.client.phone ?? "",
        },
        items,
        payments: [{ method: "20", amount: totals.total, term: null, timeUnit: "" }],
        additional_info,
        issue_date: todayInEcuador(),
        subtotal: totals.subtotal,
        discount_total: totals.discount,
        vat_total: totals.vat,
        total: totals.total,
      })
      .select("id")
      .single();
    if (error) throw error;
    await supabase.from("quotes").update({ status: "facturada" }).eq("id", quote.id);
    revalidatePath("/admin/facturas");
    revalidatePath("/admin/cotizaciones");
    return { ok: true, id: data.id };
  } catch (error) {
    return actionError(error);
  }
}

/** Crea un borrador de contrato con las partes, alcance y valor de la cotización. */
export async function createContractFromQuote(id: string): Promise<ActionResult> {
  try {
    const { supabase, quote } = await loadQuote(id);
    const settings = await getCompanySettings(supabase);
    const year = todayInEcuador().slice(0, 4);
    const seq = await nextNumber(supabase, `contrato:${year}`);

    const data: ContractData = {
      ...defaultContractData(settings),
      client: quote.client.name,
      clientId: quote.client.identification,
      clientAddress: quote.client.address ?? "",
      clientEmail: quote.client.email,
      project: quote.items[0]?.description ?? "",
      scope: quote.items.map((it) => `• ${it.description} (${it.qty} u.)`).join("\n"),
      price: toNumber(quote.total),
      payment: quote.payment_terms || defaultContractData(settings).payment,
    };

    const { data: row, error } = await supabase
      .from("contracts")
      .insert({
        number: `DN-CT-${year}-${String(seq).padStart(4, "0")}`,
        kind: "software",
        client_id: quote.client_id,
        quote_id: quote.id,
        data,
        total: toNumber(quote.total),
        contract_date: todayInEcuador(),
      })
      .select("id")
      .single();
    if (error) throw error;
    revalidatePath("/admin/contratos");
    return { ok: true, id: row.id };
  } catch (error) {
    return actionError(error);
  }
}
