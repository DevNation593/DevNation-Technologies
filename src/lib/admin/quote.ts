import { round2 } from "@/lib/sri/totals";
import type { QuoteItem } from "./types";

export const DEFAULT_QUOTE_NOTES =
  "Los valores indicados corresponden al alcance descrito en esta proforma. Cualquier requerimiento adicional será cotizado por separado.";

export function computeQuoteTotals(items: QuoteItem[], discountRate: number, taxRate: number) {
  const subtotal = round2(items.reduce((sum, it) => sum + Number(it.qty || 0) * Number(it.price || 0), 0));
  const discount = round2(subtotal * (Math.min(100, Math.max(0, discountRate)) / 100));
  const taxable = round2(subtotal - discount);
  const tax = round2(taxable * (Math.max(0, taxRate) / 100));
  return { subtotal, discount, taxable, tax, total: round2(taxable + tax) };
}
