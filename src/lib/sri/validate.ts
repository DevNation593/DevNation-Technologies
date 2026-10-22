import type { CompanySettings, Invoice } from "@/lib/admin/types";
import {
  FINAL_CONSUMER_ID,
  FINAL_CONSUMER_MAX_TOTAL,
  paymentMethods,
  vatRates,
} from "./catalogs";
import { validateIdentification } from "./identification";
import { computeInvoiceTotals, round2 } from "./totals";

type InvoiceDraft = Pick<Invoice, "buyer" | "items" | "payments" | "additional_info" | "issue_date">;

export function validateIssuer(settings: CompanySettings): string[] {
  const errors: string[] = [];
  if (!/^[0-9]{13}$/.test(settings.ruc)) errors.push("Configura el RUC del emisor (13 dígitos).");
  if (!settings.razon_social.trim()) errors.push("Configura la razón social del emisor.");
  if (!settings.dir_matriz.trim()) errors.push("Configura la dirección matriz del emisor.");
  if (!/^[0-9]{3}$/.test(settings.estab) || !/^[0-9]{3}$/.test(settings.pto_emi)) {
    errors.push("El establecimiento y el punto de emisión deben tener 3 dígitos.");
  }
  return errors;
}

/** Reglas de la ficha técnica que el SRI verifica al recibir el comprobante. */
export function validateInvoice(invoice: InvoiceDraft, today: string): string[] {
  const errors: string[] = [];
  const { buyer } = invoice;

  const idError = validateIdentification(buyer.identificationType, buyer.identification);
  if (idError) errors.push(`Comprador: ${idError}`);
  if (!buyer.name.trim()) errors.push("Comprador: indica la razón social o nombre.");

  if (!invoice.items.length) errors.push("Agrega al menos un ítem.");
  invoice.items.forEach((item, i) => {
    const n = i + 1;
    if (!item.description.trim()) errors.push(`Ítem ${n}: falta la descripción.`);
    if (!(item.quantity > 0)) errors.push(`Ítem ${n}: la cantidad debe ser mayor que 0.`);
    if (item.unitPrice < 0) errors.push(`Ítem ${n}: el precio no puede ser negativo.`);
    if (item.discount < 0 || item.discount > round2(item.quantity * item.unitPrice)) {
      errors.push(`Ítem ${n}: el descuento no puede superar el valor del ítem.`);
    }
    if (!vatRates.some((v) => v.code === item.vatCode)) errors.push(`Ítem ${n}: tarifa de IVA no válida.`);
  });

  const totals = computeInvoiceTotals(invoice.items);
  if (buyer.identification.trim() === FINAL_CONSUMER_ID && totals.total > FINAL_CONSUMER_MAX_TOTAL) {
    errors.push(`A consumidor final solo se puede facturar hasta $${FINAL_CONSUMER_MAX_TOTAL}.`);
  }

  if (!invoice.payments.length) errors.push("Indica al menos una forma de pago.");
  invoice.payments.forEach((p, i) => {
    if (!paymentMethods.some((m) => m.code === p.method)) errors.push(`Pago ${i + 1}: forma de pago no válida.`);
    if (!(p.amount > 0)) errors.push(`Pago ${i + 1}: el monto debe ser mayor que 0.`);
  });
  const paid = round2(invoice.payments.reduce((sum, p) => sum + p.amount, 0));
  if (invoice.payments.length && Math.abs(paid - totals.total) > 0.009) {
    errors.push(`Las formas de pago suman $${paid.toFixed(2)} y el total es $${totals.total.toFixed(2)}.`);
  }

  if (invoice.additional_info.length > 15) errors.push("El SRI admite máximo 15 campos adicionales.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(invoice.issue_date)) errors.push("Fecha de emisión no válida.");
  else if (invoice.issue_date > today) errors.push("La fecha de emisión no puede ser futura.");

  return errors;
}
