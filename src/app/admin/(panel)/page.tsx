import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@iconify/react";
import PageHeader from "@/components/admin/PageHeader";
import StatusBadge from "@/components/admin/StatusBadge";
import { requireAdmin } from "@/lib/admin/auth";
import { formatDate, formatMoney, invoiceNumber, todayInEcuador } from "@/lib/admin/format";
import { getCompanySettings } from "@/lib/admin/server";
import type { Invoice, Quote } from "@/lib/admin/types";
import { toNumber } from "@/lib/admin/types";
import { environments } from "@/lib/sri/catalogs";
import { getCertificateStatus } from "@/lib/sri/certificate";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Inicio" };

const modules = [
  {
    href: "/admin/facturas/nueva",
    icon: "tabler:file-invoice",
    title: "Facturar",
    text: "Emite facturas electrónicas autorizadas por el SRI y descarga el RIDE.",
  },
  {
    href: "/admin/cotizaciones/nueva",
    icon: "tabler:file-dollar",
    title: "Cotizar",
    text: "Prepara proformas profesionales y conviértelas en factura o contrato.",
  },
  {
    href: "/admin/contratos/nuevo",
    icon: "tabler:file-certificate",
    title: "Contratar",
    text: "Genera contratos de software, SaaS, soporte, consultoría o NDA.",
  },
];

export default async function DashboardPage() {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const monthStart = `${todayInEcuador().slice(0, 7)}-01`;

  const [settings, certificate, monthInvoices, pending, openQuotes, signedContracts, recentInvoices, recentQuotes] =
    await Promise.all([
      getCompanySettings(supabase),
      getCertificateStatus(),
      supabase.from("invoices").select("total, ambiente").eq("status", "autorizada").gte("issue_date", monthStart),
      supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .in("status", ["enviada", "devuelta", "no_autorizada"]),
      supabase.from("quotes").select("total").in("status", ["borrador", "enviada", "aceptada"]),
      supabase.from("contracts").select("id", { count: "exact", head: true }).eq("status", "firmado"),
      supabase
        .from("invoices")
        .select("id, status, buyer, issue_date, estab, pto_emi, secuencial, total")
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("quotes")
        .select("id, number, status, client, total, currency, issue_date")
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

  const invoiced = (monthInvoices.data ?? [])
    .filter((i) => Number(i.ambiente) === settings.ambiente)
    .reduce((sum, i) => sum + toNumber(i.total), 0);
  const quoted = (openQuotes.data ?? []).reduce((sum, q) => sum + toNumber(q.total), 0);
  const certExpiresSoon = certificate.configured && certificate.expiresSoon;

  return (
    <>
      <PageHeader title={`Hola${admin.fullName ? `, ${admin.fullName.split(" ")[0]}` : ""}`} />
      <div className="adm-content">
        {!settings.ruc && (
          <p className="notice warning">
            Completa los datos del emisor (RUC, razón social, dirección) en{" "}
            <Link href="/admin/configuracion">Configuración</Link> antes de facturar.
          </p>
        )}
        {!certificate.configured && (
          <p className="notice warning">
            Falta configurar la firma electrónica (.p12) para emitir facturas.{" "}
            <Link href="/admin/configuracion">Ver configuración</Link>
          </p>
        )}
        {certExpiresSoon && (
          <p className="notice danger">
            La firma electrónica vence el {formatDate(certificate.configured ? certificate.validTo : "")}. Renuévala a tiempo.
          </p>
        )}

        <div className="adm-stats">
          <div className="adm-card adm-stat">
            <div className="label">Facturado este mes</div>
            <div className="value">{formatMoney(invoiced)}</div>
            <div className="sub">Autorizadas · {environments[settings.ambiente]}</div>
          </div>
          <div className="adm-card adm-stat">
            <div className="label">Facturas pendientes</div>
            <div className="value">{pending.count ?? 0}</div>
            <div className="sub">En proceso o rechazadas por el SRI</div>
          </div>
          <div className="adm-card adm-stat">
            <div className="label">Cotizaciones abiertas</div>
            <div className="value">{formatMoney(quoted)}</div>
            <div className="sub">{openQuotes.data?.length ?? 0} propuestas activas</div>
          </div>
          <div className="adm-card adm-stat">
            <div className="label">Contratos firmados</div>
            <div className="value">{signedContracts.count ?? 0}</div>
            <div className="sub">Vigentes en el panel</div>
          </div>
        </div>

        <div className="adm-modules">
          {modules.map((m) => (
            <Link key={m.href} href={m.href} className="adm-card adm-module">
              <Icon icon={m.icon} aria-hidden="true" />
              <h3>{m.title}</h3>
              <p>{m.text}</p>
            </Link>
          ))}
        </div>

        <div className="adm-two">
          <section className="adm-card">
            <div className="adm-card-pad" style={{ paddingBottom: 8 }}>
              <h2>Últimas facturas</h2>
            </div>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <tbody>
                  {((recentInvoices.data ?? []) as Invoice[]).map((inv) => (
                    <tr key={inv.id}>
                      <td>
                        <Link className="row-link" href={`/admin/facturas/${inv.id}`}>
                          {invoiceNumber(inv.estab, inv.pto_emi, inv.secuencial)}
                        </Link>
                        <div className="hint">{inv.buyer?.name}</div>
                      </td>
                      <td>
                        <StatusBadge status={inv.status} invoice />
                      </td>
                      <td className="num">{formatMoney(toNumber(inv.total))}</td>
                    </tr>
                  ))}
                  {!recentInvoices.data?.length && (
                    <tr>
                      <td className="adm-empty">Sin facturas todavía.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          <section className="adm-card">
            <div className="adm-card-pad" style={{ paddingBottom: 8 }}>
              <h2>Últimas cotizaciones</h2>
            </div>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <tbody>
                  {((recentQuotes.data ?? []) as Quote[]).map((q) => (
                    <tr key={q.id}>
                      <td>
                        <Link className="row-link" href={`/admin/cotizaciones/${q.id}`}>
                          {q.number}
                        </Link>
                        <div className="hint">{q.client?.name || formatDate(q.issue_date)}</div>
                      </td>
                      <td>
                        <StatusBadge status={q.status} />
                      </td>
                      <td className="num">{formatMoney(toNumber(q.total), q.currency)}</td>
                    </tr>
                  ))}
                  {!recentQuotes.data?.length && (
                    <tr>
                      <td className="adm-empty">Sin cotizaciones todavía.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
