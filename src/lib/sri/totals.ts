import { vatRate } from "./catalogs";

export interface InvoiceItem {
  code: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  vatCode: string;
}

export interface InvoiceLine extends InvoiceItem {
  /** precioTotalSinImpuesto */
  base: number;
  rate: number;
  vat: number;
}

export interface VatGroup {
  vatCode: string;
  rate: number;
  base: number;
  vat: number;
}

export interface InvoiceTotals {
  lines: InvoiceLine[];
  groups: VatGroup[];
  subtotal: number;
  discount: number;
  vat: number;
  total: number;
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Cálculo de totales con las mismas reglas de redondeo que el XML enviado al SRI. */
export function computeInvoiceTotals(items: InvoiceItem[]): InvoiceTotals {
  const lines = items.map((item) => {
    const base = round2(item.quantity * item.unitPrice - item.discount);
    const rate = vatRate(item.vatCode);
    return { ...item, base, rate, vat: round2((base * rate) / 100) };
  });

  const byCode = new Map<string, VatGroup>();
  for (const line of lines) {
    const group = byCode.get(line.vatCode) ?? { vatCode: line.vatCode, rate: line.rate, base: 0, vat: 0 };
    group.base = round2(group.base + line.base);
    byCode.set(line.vatCode, group);
  }
  const groups = [...byCode.values()].map((g) => ({ ...g, vat: round2((g.base * g.rate) / 100) }));

  const subtotal = round2(lines.reduce((sum, l) => sum + l.base, 0));
  const discount = round2(lines.reduce((sum, l) => sum + l.discount, 0));
  const vat = round2(groups.reduce((sum, g) => sum + g.vat, 0));

  return { lines, groups, subtotal, discount, vat, total: round2(subtotal + vat) };
}
