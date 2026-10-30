import type { IdentificationType, Regime } from "@/lib/sri/catalogs";
import type { InvoiceItem } from "@/lib/sri/totals";

export interface CompanySettings {
  ruc: string;
  razon_social: string;
  nombre_comercial: string;
  dir_matriz: string;
  dir_establecimiento: string;
  estab: string;
  pto_emi: string;
  ambiente: 1 | 2;
  obligado_contabilidad: boolean;
  contribuyente_especial: string;
  agente_retencion: string;
  regimen: Regime;
  representante_legal: string;
  email: string;
  telefono: string;
  ciudad: string;
  logo_data_url: string;
  invoice_email_from: string;
  invoice_email_reply_to: string;
  invoice_email_bcc: string;
  updated_at?: string;
}

export interface Client {
  id: string;
  identification_type: IdentificationType;
  identification: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  legal_representative: string;
}

/** Datos del cliente copiados en el documento (no cambian si luego se edita el cliente). */
export interface ClientSnapshot {
  name: string;
  identification: string;
  email: string;
  phone: string;
  address: string;
  legalRepresentative?: string;
}

export type QuoteStatus = "borrador" | "enviada" | "aceptada" | "rechazada" | "facturada";

export interface QuoteItem {
  description: string;
  qty: number;
  price: number;
}

export interface Quote {
  id: string;
  number: string;
  status: QuoteStatus;
  issue_date: string;
  valid_days: number;
  currency: "USD" | "EUR";
  client_id: string | null;
  client: ClientSnapshot;
  items: QuoteItem[];
  tax_rate: number;
  discount_rate: number;
  payment_terms: string;
  delivery_time: string;
  notes: string;
  subtotal: number;
  total: number;
  created_at: string;
  updated_at: string;
}

export type ContractKind = "software" | "saas" | "support" | "consult" | "nda";
export type ContractStatus = "borrador" | "enviado" | "firmado" | "finalizado" | "anulado";

export interface ContractData {
  city: string;
  provider: string;
  providerId: string;
  providerRep: string;
  providerAddress: string;
  providerEmail: string;
  client: string;
  clientId: string;
  clientRep: string;
  clientAddress: string;
  clientEmail: string;
  project: string;
  scope: string;
  price: number;
  months: number;
  payment: string;
  schedule: string;
  sla: string;
  notice: number;
  clauses: {
    ip: boolean;
    privacy: boolean;
    confidential: boolean;
    warranty: boolean;
    termination: boolean;
    force: boolean;
    disputes: boolean;
  };
  customTitle: string;
  customText: string;
}

export interface Contract {
  id: string;
  number: string;
  kind: ContractKind;
  status: ContractStatus;
  contract_date: string;
  client_id: string | null;
  quote_id: string | null;
  data: ContractData;
  total: number;
  created_at: string;
  updated_at: string;
}

export type InvoiceStatus =
  | "borrador"
  | "enviada"
  | "autorizada"
  | "devuelta"
  | "no_autorizada"
  | "anulada";

export interface InvoiceBuyer {
  identificationType: IdentificationType;
  identification: string;
  name: string;
  address: string;
  email: string;
  phone: string;
}

export interface InvoicePayment {
  method: string;
  amount: number;
  term: number | null;
  timeUnit: string;
}

export interface AdditionalInfo {
  name: string;
  value: string;
}

export interface SriMessage {
  identificador: string;
  mensaje: string;
  informacionAdicional?: string;
  tipo: string;
}

export interface Invoice {
  id: string;
  status: InvoiceStatus;
  quote_id: string | null;
  client_id: string | null;
  buyer: InvoiceBuyer;
  items: InvoiceItem[];
  payments: InvoicePayment[];
  additional_info: AdditionalInfo[];
  issue_date: string;
  ambiente: 1 | 2 | null;
  estab: string | null;
  pto_emi: string | null;
  secuencial: string | null;
  access_key: string | null;
  subtotal: number;
  discount_total: number;
  vat_total: number;
  total: number;
  signed_xml: string | null;
  authorized_xml: string | null;
  authorization_number: string | null;
  authorized_at: string | null;
  sri_messages: SriMessage[];
  last_emailed_at: string | null;
  last_emailed_to: string | null;
  last_email_error: string | null;
  created_at: string;
  updated_at: string;
}

/** Postgres devuelve numeric como string; los convierte a number. */
export function toNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}
