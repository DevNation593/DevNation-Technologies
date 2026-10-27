import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { listClients } from "@/lib/admin/queries";
import { getCompanySettings } from "@/lib/admin/server";
import type { Contract } from "@/lib/admin/types";
import { createClient } from "@/lib/supabase/server";
import ContractEditor from "../ContractEditor";

export const metadata: Metadata = { title: "Contrato" };

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("contracts").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();

  const [settings, clients] = await Promise.all([getCompanySettings(supabase), listClients()]);
  return <ContractEditor contract={data as Contract} settings={settings} clients={clients} />;
}
