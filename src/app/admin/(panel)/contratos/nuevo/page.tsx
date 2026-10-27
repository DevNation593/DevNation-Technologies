import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/auth";
import { listClients } from "@/lib/admin/queries";
import { getCompanySettings } from "@/lib/admin/server";
import { createClient } from "@/lib/supabase/server";
import ContractEditor from "../ContractEditor";

export const metadata: Metadata = { title: "Nuevo contrato" };

export default async function NewContractPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [settings, clients] = await Promise.all([getCompanySettings(supabase), listClients()]);
  return <ContractEditor contract={null} settings={settings} clients={clients} />;
}
