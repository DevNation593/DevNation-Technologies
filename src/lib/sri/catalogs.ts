// Catálogos de la ficha técnica de comprobantes electrónicos del SRI.

export const identificationTypes = [
  { code: "04", label: "RUC" },
  { code: "05", label: "Cédula" },
  { code: "06", label: "Pasaporte" },
  { code: "07", label: "Consumidor final" },
  { code: "08", label: "Identificación del exterior" },
] as const;

export type IdentificationType = (typeof identificationTypes)[number]["code"];

export const FINAL_CONSUMER_ID = "9999999999999";
export const FINAL_CONSUMER_NAME = "CONSUMIDOR FINAL";
/** Monto máximo que el SRI permite facturar a consumidor final. */
export const FINAL_CONSUMER_MAX_TOTAL = 50;

/** Código de impuesto IVA (tabla 16) y tarifas (tabla 17). */
export const VAT_TAX_CODE = "2";

export const vatRates = [
  { code: "4", label: "IVA 15%", short: "15%", rate: 15 },
  { code: "5", label: "IVA 5%", short: "5%", rate: 5 },
  { code: "0", label: "IVA 0%", short: "0%", rate: 0 },
  { code: "6", label: "No objeto de IVA", short: "No objeto", rate: 0 },
  { code: "7", label: "Exento de IVA", short: "Exento", rate: 0 },
] as const;

export type VatCode = (typeof vatRates)[number]["code"];

export function vatRate(code: string): number {
  return vatRates.find((v) => v.code === code)?.rate ?? 0;
}

export function vatLabel(code: string): string {
  return vatRates.find((v) => v.code === code)?.label ?? `IVA código ${code}`;
}

/** Formas de pago (tabla 24). */
export const paymentMethods = [
  { code: "20", label: "Otros con utilización del sistema financiero" },
  { code: "01", label: "Sin utilización del sistema financiero" },
  { code: "19", label: "Tarjeta de crédito" },
  { code: "16", label: "Tarjeta de débito" },
  { code: "17", label: "Dinero electrónico" },
  { code: "18", label: "Tarjeta prepago" },
  { code: "15", label: "Compensación de deudas" },
  { code: "21", label: "Endoso de títulos" },
] as const;

export function paymentMethodLabel(code: string): string {
  return paymentMethods.find((p) => p.code === code)?.label ?? code;
}

export const environments = {
  1: "Pruebas",
  2: "Producción",
} as const;

export type SriEnvironment = keyof typeof environments;

export const regimes = [
  { code: "GENERAL", label: "Régimen general", xml: "" },
  {
    code: "RIMPE_EMPRENDEDOR",
    label: "RIMPE — Emprendedor",
    xml: "CONTRIBUYENTE RÉGIMEN RIMPE",
  },
  {
    code: "RIMPE_NEGOCIO_POPULAR",
    label: "RIMPE — Negocio popular",
    xml: "CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE",
  },
] as const;

export type Regime = (typeof regimes)[number]["code"];

export const INVOICE_DOC_CODE = "01";
