import type { Metadata } from "next";
import Link from "next/link";
import ListFilters from "@/components/admin/ListFilters";
import PageHeader from "@/components/admin/PageHeader";
import StatusBadge from "@/components/admin/StatusBadge";
import { requireAdmin } from "@/lib/admin/auth";
import { contractKinds } from "@/lib/admin/contract-template";
import { formatDate, formatMoney } from "@/lib/admin/format";
import { searchPattern } from "@/lib/admin/queries";
import type { Contract } from "@/lib/admin/types";
import { toNumber } from "@/lib/admin/types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Contratos" };

const statuses = [
  { value: "borrador", label: "Borrador" },
  { value: "enviado", label: "Enviado" },
  { value: "firmado", label: "Firmado" },
  { value: "finalizado", label: "Finalizado" },
  { value: "anulado", label: "Anulado" },
];

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  await requireAdmin();
  const { q, status } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("contracts")
    .select("id, number, kind, status, contract_date, data, total")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status) query = query.eq("status", status);
  if (q) query = query.or(`number.ilike.${searchPattern(q)},data->>client.ilike.${searchPattern(q)}`);
  const { data, error } = await query;
  const contracts = (data ?? []) as Pick<
    Contract,
    "id" | "number" | "kind" | "status" | "contract_date" | "data" | "total"
  >[];

  return (
    <>
      <PageHeader title="Contratos">
        <Link href="/admin/contratos/nuevo" className="btn btn-primary">
          + Nuevo contrato
        </Link>
      </PageHeader>
      <div className="adm-content">
        <ListFilters q={q} status={status} statuses={statuses} placeholder="Buscar por número o cliente" />
        {error && <p className="notice danger">{error.message}</p>}
        <div className="adm-card adm-table-wrap">
          {contracts.length ? (
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Tipo</th>
                  <th>Cliente</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th className="num">Valor</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link className="row-link" href={`/admin/contratos/${c.id}`}>
                        {c.number}
                      </Link>
                    </td>
                    <td>{contractKinds.find((k) => k.value === c.kind)?.label}</td>
                    <td>{c.data?.client || "—"}</td>
                    <td>{formatDate(c.contract_date)}</td>
                    <td>
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="num">{c.kind === "nda" ? "—" : formatMoney(toNumber(c.total))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="adm-empty">No hay contratos{q || status ? " con esos filtros" : " todavía"}.</p>
          )}
        </div>
      </div>
    </>
  );
}
