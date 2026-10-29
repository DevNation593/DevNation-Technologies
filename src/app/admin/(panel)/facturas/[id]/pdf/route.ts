import { requireAdmin } from "@/lib/admin/auth";
import { getCompanySettings } from "@/lib/admin/server";
import type { Invoice } from "@/lib/admin/types";
import { buildRideData } from "@/lib/sri/ride";
import { renderRidePdf } from "@/lib/sri/ride-pdf";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("invoices").select("*").eq("id", id).maybeSingle();

  const invoice = data as Invoice | null;
  if (!invoice?.access_key || (invoice.status !== "autorizada" && invoice.status !== "anulada")) {
    return new Response("No encontrado", { status: 404 });
  }

  const settings = await getCompanySettings(supabase);
  const ride = buildRideData(invoice, settings);
  const pdf = await renderRidePdf(ride, settings.logo_data_url);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${ride.fileBase}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
