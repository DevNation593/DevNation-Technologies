import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/auth";
import { listClients } from "@/lib/admin/queries";
import { getCompanySettings } from "@/lib/admin/server";
import { createClient } from "@/lib/supabase/server";
import QuoteEditor from "../QuoteEditor";

export const metadata: Metadata = { title: "Nueva proforma" };

export default async function NewQuotePage() {
  await requireAdmin();
  const supabase = await createClient();
  const [settings, clients] = await Promise.all([getCompanySettings(supabase), listClients()]);
  return <QuoteEditor quote={null} settings={settings} clients={clients} />;
}
