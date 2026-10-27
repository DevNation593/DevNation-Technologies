import type { Metadata } from "next";
import Link from "next/link";
import ListFilters from "@/components/admin/ListFilters";
import PageHeader from "@/components/admin/PageHeader";
import StatusBadge from "@/components/admin/StatusBadge";
import { requireAdmin } from "@/lib/admin/auth";
import { formatDate, formatMoney, invoiceNumber } from "@/lib/admin/format";
import { searchPattern } from "@/lib/admin/queries";
import type { Invoice } from "@/lib/admin/types";
import { toNumber } from "@/lib/admin/types";
import { environments } from "@/lib/sri/catalogs";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Facturación" };

const statuses = [
  { value: "borrador", label: "Borrador" },
  { value: "enviada", label: "En proceso SRI" },
  { value: "autorizada", label: "Autorizada" },
  { value: "devuelta", label: "Devuelta" },
  { value: "no_autorizada", label: "No autorizada" },
  { value: "anulada", label: "Anulada" },
];

type Row = Pick<
  Invoice,
  "id" | "status" | "buyer" | "issue_date" | "estab" | "pto_emi" | "secuencial" | "ambiente" | "total"
>;

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  await requireAdmin();
  const { q, status } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("invoices")
    .select("id, status, buyer, issue_date, estab, pto_emi, secuencial, ambiente, total")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status) query = query.eq("status", status);
  if (q) {
    const pattern = searchPattern(q);
    query = query.or(
      `secuencial.ilike.${pattern},access_key.ilike.${pattern},buyer->>name.ilike.${pattern},buyer->>identification.ilike.${pattern}`,
    );
  }
  const { data, error } = await query;
  const invoices = (data ?? []) as Row[];

  return (
    <>
      <PageHeader title="Facturación electrónica">
        <Link href="/admin/facturas/nueva" className="btn btn-primary">
          + Nueva factura
        </Link>
      </PageHeader>
      <div className="adm-content">
        <ListFilters q={q} status={status} statuses={statuses} placeholder="Número, clave, cliente o RUC" />
        {error && <p className="notice danger">{error.message}</p>}
        <div className="adm-card adm-table-wrap">
          {invoices.length ? (
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Comprador</th>
                  <th>Fecha</th>
                  <th>Ambiente</th>
                  <th>Estado</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <Link className="row-link" href={`/admin/facturas/${inv.id}`}>
                        {invoiceNumber(inv.estab, inv.pto_emi, inv.secuencial)}
                      </Link>
                    </td>
                    <td>
                      {inv.buyer?.name || "—"}
                      <div className="hint">{inv.buyer?.identification}</div>
                    </td>
                    <td>{formatDate(inv.issue_date)}</td>
                    <td>{inv.ambiente ? environments[inv.ambiente] : "—"}</td>
                    <td>
                      <StatusBadge status={inv.status} invoice />
                    </td>
                    <td className="num">{formatMoney(toNumber(inv.total))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="adm-empty">No hay facturas{q || status ? " con esos filtros" : " todavía"}.</p>
          )}
        </div>
      </div>
    </>
  );
}
