import type { Metadata } from "next";
import Link from "next/link";
import ListFilters from "@/components/admin/ListFilters";
import PageHeader from "@/components/admin/PageHeader";
import StatusBadge from "@/components/admin/StatusBadge";
import { requireAdmin } from "@/lib/admin/auth";
import { formatDate, formatMoney } from "@/lib/admin/format";
import { searchPattern } from "@/lib/admin/queries";
import type { Quote } from "@/lib/admin/types";
import { toNumber } from "@/lib/admin/types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Cotizaciones" };

const statuses = [
  { value: "borrador", label: "Borrador" },
  { value: "enviada", label: "Enviada" },
  { value: "aceptada", label: "Aceptada" },
  { value: "rechazada", label: "Rechazada" },
  { value: "facturada", label: "Facturada" },
];

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  await requireAdmin();
  const { q, status } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("quotes")
    .select("id, number, status, issue_date, currency, client, total")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status) query = query.eq("status", status);
  if (q) query = query.or(`number.ilike.${searchPattern(q)},client->>name.ilike.${searchPattern(q)}`);
  const { data, error } = await query;
  const quotes = (data ?? []) as Pick<Quote, "id" | "number" | "status" | "issue_date" | "currency" | "client" | "total">[];

  return (
    <>
      <PageHeader title="Cotizaciones">
        <Link href="/admin/cotizaciones/nueva" className="btn btn-primary">
          + Nueva proforma
        </Link>
      </PageHeader>
      <div className="adm-content">
        <ListFilters q={q} status={status} statuses={statuses} placeholder="Buscar por número o cliente" />
        {error && <p className="notice danger">{error.message}</p>}
        <div className="adm-card adm-table-wrap">
          {quotes.length ? (
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Cliente</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((quote) => (
                  <tr key={quote.id}>
                    <td>
                      <Link className="row-link" href={`/admin/cotizaciones/${quote.id}`}>
                        {quote.number}
                      </Link>
                    </td>
                    <td>{quote.client?.name || "—"}</td>
                    <td>{formatDate(quote.issue_date)}</td>
                    <td>
                      <StatusBadge status={quote.status} />
                    </td>
                    <td className="num">{formatMoney(toNumber(quote.total), quote.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="adm-empty">
              No hay cotizaciones{q || status ? " con esos filtros" : " todavía"}.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
