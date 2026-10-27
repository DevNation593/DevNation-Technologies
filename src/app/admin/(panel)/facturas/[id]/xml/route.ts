import { requireAdmin } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("invoices")
    .select("access_key, authorized_xml, signed_xml")
    .eq("id", id)
    .maybeSingle();

  const xml = data?.authorized_xml ?? data?.signed_xml;
  if (!data || !xml) return new Response("No encontrado", { status: 404 });

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${data.access_key}.xml"`,
      "Cache-Control": "private, no-store",
    },
  });
}
