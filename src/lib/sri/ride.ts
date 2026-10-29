import { formatDate, formatDateTime, formatMoney, invoiceNumber } from "@/lib/admin/format";
import type { CompanySettings, Invoice } from "@/lib/admin/types";
import { environments, identificationTypes, paymentMethodLabel, regimes, vatLabel } from "./catalogs";
import { computeInvoiceTotals } from "./totals";
import { decimal6 } from "./xml";

/** Fila etiqueta/valor del RIDE. Sin etiqueta, solo se muestra el valor. */
export interface RideRow {
  label: string;
  value: string;
  strong?: boolean;
}

/**
 * Todo lo que muestra el RIDE ya calculado y formateado, para que la página
 * HTML y el PDF del correo enseñen exactamente lo mismo.
 */
export interface RideData {
  number: string;
  /** Nombre base de los adjuntos, p. ej. "FACTURA-001-001-000000123". */
  fileBase: string;
  authorized: boolean;
  issuer: { ruc: string; razonSocial: string; nombreComercial: string; rows: RideRow[] };
  authorizationNumber: string;
  authorizedAt: string;
  environment: string;
  accessKey: string;
  buyer: { name: string; idLabel: string; identification: string; address: string; email: string };
  issueDate: string;
  lines: { code: string; quantity: string; description: string; unitPrice: string; discount: string; total: string }[];
  additionalInfo: { name: string; value: string }[];
  payments: { label: string; amount: string; term: string }[];
  totals: RideRow[];
  total: number;
}

export function buildRideData(invoice: Invoice, settings: CompanySettings): RideData {
  const totals = computeInvoiceTotals(invoice.items);
  const number = invoiceNumber(invoice.estab, invoice.pto_emi, invoice.secuencial);
  const regime = regimes.find((r) => r.code === settings.regimen)?.xml;
  const ambiente = Number(invoice.ambiente) as 1 | 2;

  const issuerRows: RideRow[] = [{ label: "Dirección matriz", value: settings.dir_matriz }];
  if (settings.dir_establecimiento) issuerRows.push({ label: "Dirección sucursal", value: settings.dir_establecimiento });
  if (settings.contribuyente_especial) {
    issuerRows.push({ label: "Contribuyente especial Nro.", value: settings.contribuyente_especial });
  }
  issuerRows.push({ label: "Obligado a llevar contabilidad", value: settings.obligado_contabilidad ? "SÍ" : "NO" });
  if (settings.agente_retencion) {
    issuerRows.push({ label: "Agente de retención Resolución Nro.", value: settings.agente_retencion });
  }
  if (regime) issuerRows.push({ label: "", value: regime });

  return {
    number,
    fileBase: `FACTURA-${number}`,
    authorized: invoice.status === "autorizada" || invoice.status === "anulada",
    issuer: {
      ruc: settings.ruc,
      razonSocial: settings.razon_social,
      nombreComercial: settings.nombre_comercial !== settings.razon_social ? settings.nombre_comercial : "",
      rows: issuerRows,
    },
    authorizationNumber: invoice.authorization_number ?? invoice.access_key ?? "",
    authorizedAt: invoice.authorized_at ? formatDateTime(invoice.authorized_at) : "PENDIENTE",
    environment: environments[ambiente].toUpperCase(),
    accessKey: invoice.access_key ?? "",
    buyer: {
      name: invoice.buyer.name,
      idLabel:
        identificationTypes.find((t) => t.code === invoice.buyer.identificationType)?.label ?? "Identificación",
      identification: invoice.buyer.identification,
      address: invoice.buyer.address,
      email: invoice.buyer.email,
    },
    issueDate: formatDate(invoice.issue_date),
    lines: totals.lines.map((line, i) => ({
      code: line.code || `ITEM${i + 1}`,
      quantity: decimal6(line.quantity),
      description: line.description,
      unitPrice: decimal6(line.unitPrice),
      discount: line.discount.toFixed(2),
      total: line.base.toFixed(2),
    })),
    additionalInfo: invoice.additional_info.filter((f) => f.name && f.value),
    payments: invoice.payments.map((p) => ({
      label: `${p.method} - ${paymentMethodLabel(p.method).toUpperCase()}`,
      amount: p.amount.toFixed(2),
      term: p.term ? `${p.term} ${p.timeUnit}` : "—",
    })),
    totals: [
      ...totals.groups.map((g) => ({ label: `SUBTOTAL ${vatLabel(g.vatCode).toUpperCase()}`, value: g.base.toFixed(2) })),
      { label: "SUBTOTAL SIN IMPUESTOS", value: totals.subtotal.toFixed(2) },
      { label: "TOTAL DESCUENTO", value: totals.discount.toFixed(2) },
      ...totals.groups
        .filter((g) => g.rate > 0)
        .map((g) => ({ label: vatLabel(g.vatCode).toUpperCase(), value: g.vat.toFixed(2) })),
      { label: "PROPINA", value: "0.00" },
      { label: "VALOR TOTAL", value: formatMoney(totals.total), strong: true },
    ],
    total: totals.total,
  };
}
