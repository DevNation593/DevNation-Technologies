import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { listClients } from "@/lib/admin/queries";
import { getCompanySettings } from "@/lib/admin/server";
import type { Quote } from "@/lib/admin/types";
import { createClient } from "@/lib/supabase/server";
import QuoteEditor from "../QuoteEditor";

export const metadata: Metadata = { title: "Proforma" };

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("quotes").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();

  const [settings, clients] = await Promise.all([getCompanySettings(supabase), listClients()]);
  return <QuoteEditor quote={data as Quote} settings={settings} clients={clients} />;
}
