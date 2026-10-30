import { requireAdmin } from "@/lib/admin/auth";
import { loadInvoiceXml } from "@/lib/admin/storage";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("invoices")
    .select("access_key, authorized_xml, authorized_xml_path, authorized_xml_sha256, signed_xml, signed_xml_path")
    .eq("id", id)
    .maybeSingle();

  let xml: string | null = null;
  try {
    xml = data ? await loadInvoiceXml(supabase, data) : null;
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "No se pudo leer el XML.", { status: 502 });
  }
  if (!data || !xml) return new Response("No encontrado", { status: 404 });

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${data.access_key}.xml"`,
      "Cache-Control": "private, no-store",
    },
  });
}
