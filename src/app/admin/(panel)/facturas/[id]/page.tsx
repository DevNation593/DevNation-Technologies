import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { listClients } from "@/lib/admin/queries";
import { getCompanySettings } from "@/lib/admin/server";
import type { Invoice } from "@/lib/admin/types";
import { getCertificateStatus } from "@/lib/sri/certificate";
import { createClient } from "@/lib/supabase/server";
import InvoiceEditor from "../InvoiceEditor";

// Emitir incluye la recepción y varias consultas de autorización al SRI.
export const maxDuration = 60;

export const metadata: Metadata = { title: "Factura" };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("invoices").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();

  const [settings, clients, certificate] = await Promise.all([
    getCompanySettings(supabase),
    listClients(),
    getCertificateStatus(),
  ]);
  return (
    <InvoiceEditor
      invoice={{ ...(data as Invoice), ambiente: data.ambiente === null ? null : (Number(data.ambiente) as 1 | 2) }}
      settings={settings}
      clients={clients}
      certificateReady={certificate.configured && !certificate.expired}
    />
  );
}
