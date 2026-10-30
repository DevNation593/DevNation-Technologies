import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/auth";
import { listClients, listProducts } from "@/lib/admin/queries";
import { getCompanySettings } from "@/lib/admin/server";
import { getCertificateStatus } from "@/lib/sri/certificate";
import { createClient } from "@/lib/supabase/server";
import InvoiceEditor from "../InvoiceEditor";

// Emitir incluye la recepción y varias consultas de autorización al SRI.
export const maxDuration = 60;

export const metadata: Metadata = { title: "Nueva factura" };

export default async function NewInvoicePage() {
  await requireAdmin();
  const supabase = await createClient();
  const [settings, clients, products, certificate] = await Promise.all([
    getCompanySettings(supabase),
    listClients(),
    listProducts(),
    getCertificateStatus(),
  ]);
  return (
    <InvoiceEditor
      invoice={null}
      settings={settings}
      clients={clients}
      products={products}
      certificateReady={certificate.configured && !certificate.expired}
    />
  );
}
