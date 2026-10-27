import type { CompanySettings, Invoice } from "@/lib/admin/types";
import {
  INVOICE_DOC_CODE,
  VAT_TAX_CODE,
  regimes,
} from "./catalogs";
import { computeInvoiceTotals } from "./totals";

// El XML se genera directamente en forma canónica (C14N): sin declaraciones
// vacías, sin etiquetas autocerradas, atributos ordenados y solo &, < y >
// escapados en el texto. Así el digest calculado en la firma coincide con el
// que recalcula el SRI.

// Caracteres no permitidos en XML 1.0 y saltos de línea que el SRI rechaza.
const INVALID_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

export function cleanText(value: string, maxLength = 300): string {
  return value.replace(INVALID_CHARS, "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;")
    .replace(/\t/g, "&#x9;")
    .replace(/\n/g, "&#xA;")
    .replace(/\r/g, "&#xD;");
}

function tag(name: string, value: string | number): string {
  return `<${name}>${escapeText(String(value))}</${name}>`;
}

function optionalTag(name: string, value: string | null | undefined): string {
  const text = value ? cleanText(value) : "";
  return text ? tag(name, text) : "";
}

function group(name: string, ...children: string[]): string {
  return `<${name}>${children.join("")}</${name}>`;
}

export function money(value: number): string {
  return value.toFixed(2);
}

/** Cantidades y precios unitarios: mínimo 2 y hasta 6 decimales (versión 1.1.0). */
export function decimal6(value: number): string {
  const fixed = value.toFixed(6).replace(/0+$/, "");
  const [int, dec = ""] = fixed.split(".");
  return `${int}.${dec.padEnd(2, "0")}`;
}

export function formatSriDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

export interface InvoiceXmlInput {
  invoice: Pick<Invoice, "buyer" | "items" | "payments" | "additional_info" | "issue_date">;
  settings: CompanySettings;
  environment: 1 | 2;
  estab: string;
  ptoEmi: string;
  secuencial: string;
  accessKey: string;
}

/** Devuelve el elemento <factura> (sin declaración XML ni firma). */
export function buildInvoiceXml({
  invoice,
  settings,
  environment,
  estab,
  ptoEmi,
  secuencial,
  accessKey,
}: InvoiceXmlInput): string {
  const totals = computeInvoiceTotals(invoice.items);
  const regimeText = regimes.find((r) => r.code === settings.regimen)?.xml ?? "";

  const infoTributaria = group(
    "infoTributaria",
    tag("ambiente", environment),
    tag("tipoEmision", "1"),
    tag("razonSocial", cleanText(settings.razon_social)),
    optionalTag("nombreComercial", settings.nombre_comercial),
    tag("ruc", settings.ruc),
    tag("claveAcceso", accessKey),
    tag("codDoc", INVOICE_DOC_CODE),
    tag("estab", estab),
    tag("ptoEmi", ptoEmi),
    tag("secuencial", secuencial),
    tag("dirMatriz", cleanText(settings.dir_matriz)),
    optionalTag("agenteRetencion", settings.agente_retencion),
    regimeText ? tag("contribuyenteRimpe", regimeText) : "",
  );

  const totalConImpuestos = group(
    "totalConImpuestos",
    ...totals.groups.map((g) =>
      group(
        "totalImpuesto",
        tag("codigo", VAT_TAX_CODE),
        tag("codigoPorcentaje", g.vatCode),
        tag("baseImponible", money(g.base)),
        tag("valor", money(g.vat)),
      ),
    ),
  );

  const pagos = group(
    "pagos",
    ...invoice.payments.map((p) =>
      group(
        "pago",
        tag("formaPago", p.method),
        tag("total", money(p.amount)),
        p.term ? tag("plazo", p.term) : "",
        p.term && p.timeUnit ? tag("unidadTiempo", cleanText(p.timeUnit, 10)) : "",
      ),
    ),
  );

  const infoFactura = group(
    "infoFactura",
    tag("fechaEmision", formatSriDate(invoice.issue_date)),
    optionalTag("dirEstablecimiento", settings.dir_establecimiento),
    optionalTag("contribuyenteEspecial", settings.contribuyente_especial),
    tag("obligadoContabilidad", settings.obligado_contabilidad ? "SI" : "NO"),
    tag("tipoIdentificacionComprador", invoice.buyer.identificationType),
    tag("razonSocialComprador", cleanText(invoice.buyer.name)),
    tag("identificacionComprador", invoice.buyer.identification.trim()),
    optionalTag("direccionComprador", invoice.buyer.address),
    tag("totalSinImpuestos", money(totals.subtotal)),
    tag("totalDescuento", money(totals.discount)),
    totalConImpuestos,
    tag("propina", "0.00"),
    tag("importeTotal", money(totals.total)),
    tag("moneda", "DOLAR"),
    pagos,
  );

  const detalles = group(
    "detalles",
    ...totals.lines.map((line, index) =>
      group(
        "detalle",
        tag("codigoPrincipal", cleanText(line.code, 25) || `ITEM${index + 1}`),
        tag("descripcion", cleanText(line.description)),
        tag("cantidad", decimal6(line.quantity)),
        tag("precioUnitario", decimal6(line.unitPrice)),
        tag("descuento", money(line.discount)),
        tag("precioTotalSinImpuesto", money(line.base)),
        group(
          "impuestos",
          group(
            "impuesto",
            tag("codigo", VAT_TAX_CODE),
            tag("codigoPorcentaje", line.vatCode),
            tag("tarifa", line.rate),
            tag("baseImponible", money(line.base)),
            tag("valor", money(line.vat)),
          ),
        ),
      ),
    ),
  );

  const extraFields = invoice.additional_info
    .map((f) => ({ name: cleanText(f.name, 300), value: cleanText(f.value, 300) }))
    .filter((f) => f.name && f.value)
    .slice(0, 15);
  const infoAdicional = extraFields.length
    ? group(
        "infoAdicional",
        ...extraFields.map(
          (f) => `<campoAdicional nombre="${escapeAttribute(f.name)}">${escapeText(f.value)}</campoAdicional>`,
        ),
      )
    : "";

  return `<factura id="comprobante" version="1.1.0">${infoTributaria}${infoFactura}${detalles}${infoAdicional}</factura>`;
}
