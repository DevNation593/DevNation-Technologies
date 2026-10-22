import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Barcode from "@/components/admin/Barcode";
import CompanyLogo from "@/components/admin/CompanyLogo";
import PageHeader from "@/components/admin/PageHeader";
import PrintButton from "@/components/admin/PrintButton";
import { requireAdmin } from "@/lib/admin/auth";
import { formatDate, formatDateTime, formatMoney, invoiceNumber } from "@/lib/admin/format";
import { getCompanySettings } from "@/lib/admin/server";
import type { Invoice } from "@/lib/admin/types";
import {
  environments,
  identificationTypes,
  paymentMethodLabel,
  regimes,
  vatLabel,
} from "@/lib/sri/catalogs";
import { computeInvoiceTotals } from "@/lib/sri/totals";
import { decimal6 } from "@/lib/sri/xml";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "RIDE" };

export default async function RidePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("invoices").select("*").eq("id", id).maybeSingle();
  if (!data?.access_key) notFound();

  const invoice = data as Invoice;
  const settings = await getCompanySettings(supabase);
  const totals = computeInvoiceTotals(invoice.items);
  const regime = regimes.find((r) => r.code === settings.regimen)?.xml;
  const authorized = invoice.status === "autorizada" || invoice.status === "anulada";
  const ambiente = Number(invoice.ambiente) as 1 | 2;

  return (
    <>
      <PageHeader
        title={`RIDE ${invoiceNumber(invoice.estab, invoice.pto_emi, invoice.secuencial)}`}
        crumbs={[
          { href: "/admin/facturas", label: "Facturación" },
          { href: `/admin/facturas/${invoice.id}`, label: "Factura" },
        ]}
      >
        <Link className="btn btn-secondary" href={`/admin/facturas/${invoice.id}`}>
          Volver
        </Link>
        <PrintButton />
      </PageHeader>

      <div className="adm-content">
        {!authorized && (
          <p className="notice warning no-print">
            Esta factura aún no está autorizada por el SRI: el RIDE no tiene validez hasta su autorización.
          </p>
        )}
        <article className="ride">
          <div className="ride-top">
            <div>
              <div className="ride-logo">
                <CompanyLogo src={settings.logo_data_url} />
              </div>
              <div className="ride-box">
                <p>
                  <strong style={{ fontSize: 14 }}>{settings.razon_social}</strong>
                </p>
                {settings.nombre_comercial && settings.nombre_comercial !== settings.razon_social && (
                  <p>{settings.nombre_comercial}</p>
                )}
                <p>
                  <strong>Dirección matriz:</strong> {settings.dir_matriz}
                </p>
                {settings.dir_establecimiento && (
                  <p>
                    <strong>Dirección sucursal:</strong> {settings.dir_establecimiento}
                  </p>
                )}
                {settings.contribuyente_especial && (
                  <p>
                    <strong>Contribuyente especial Nro.:</strong> {settings.contribuyente_especial}
                  </p>
                )}
                <p>
                  <strong>Obligado a llevar contabilidad:</strong> {settings.obligado_contabilidad ? "SÍ" : "NO"}
                </p>
                {settings.agente_retencion && (
                  <p>
                    <strong>Agente de retención Resolución Nro.:</strong> {settings.agente_retencion}
                  </p>
                )}
                {regime && <p>{regime}</p>}
              </div>
            </div>
            <div className="ride-box">
              <p>
                <strong>R.U.C.:</strong> {settings.ruc}
              </p>
              <h2>FACTURA</h2>
              <p>
                <strong>No.</strong> {invoiceNumber(invoice.estab, invoice.pto_emi, invoice.secuencial)}
              </p>
              <p>
                <strong>NÚMERO DE AUTORIZACIÓN</strong>
              </p>
              <p className="key">{invoice.authorization_number ?? invoice.access_key}</p>
              <p>
                <strong>FECHA Y HORA DE AUTORIZACIÓN:</strong>{" "}
                {invoice.authorized_at ? formatDateTime(invoice.authorized_at) : "PENDIENTE"}
              </p>
              <p>
                <strong>AMBIENTE:</strong> {environments[ambiente].toUpperCase()}
              </p>
              <p>
                <strong>EMISIÓN:</strong> NORMAL
              </p>
              <p>
                <strong>CLAVE DE ACCESO</strong>
              </p>
              <div className="barcode">
                <Barcode value={invoice.access_key!} />
              </div>
              <p className="key">{invoice.access_key}</p>
            </div>
          </div>

          <div className="ride-box" style={{ marginTop: 12 }}>
            <p>
              <strong>Razón social / Nombres y apellidos:</strong> {invoice.buyer.name}
            </p>
            <p>
              <strong>
                {identificationTypes.find((t) => t.code === invoice.buyer.identificationType)?.label ?? "Identificación"}:
              </strong>{" "}
              {invoice.buyer.identification}
              <span style={{ marginLeft: 24 }}>
                <strong>Fecha de emisión:</strong> {formatDate(invoice.issue_date)}
              </span>
            </p>
            {invoice.buyer.address && (
              <p>
                <strong>Dirección:</strong> {invoice.buyer.address}
              </p>
            )}
          </div>

          <table>
            <thead>
              <tr>
                <th>Cód. principal</th>
                <th className="num">Cant.</th>
                <th>Descripción</th>
                <th className="num">Precio unitario</th>
                <th className="num">Descuento</th>
                <th className="num">Precio total</th>
              </tr>
            </thead>
            <tbody>
              {totals.lines.map((line, i) => (
                <tr key={i}>
                  <td>{line.code || `ITEM${i + 1}`}</td>
                  <td className="num">{decimal6(line.quantity)}</td>
                  <td>{line.description}</td>
                  <td className="num">{decimal6(line.unitPrice)}</td>
                  <td className="num">{line.discount.toFixed(2)}</td>
                  <td className="num">{line.base.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="ride-bottom">
            <div>
              {invoice.additional_info.some((f) => f.name && f.value) && (
                <table>
                  <thead>
                    <tr>
                      <th colSpan={2}>Información adicional</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.additional_info
                      .filter((f) => f.name && f.value)
                      .map((f) => (
                        <tr key={f.name}>
                          <td>{f.name}</td>
                          <td>{f.value}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
              <table>
                <thead>
                  <tr>
                    <th>Forma de pago</th>
                    <th className="num">Valor</th>
                    <th>Plazo</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.payments.map((p, i) => (
                    <tr key={i}>
                      <td>
                        {p.method} - {paymentMethodLabel(p.method).toUpperCase()}
                      </td>
                      <td className="num">{p.amount.toFixed(2)}</td>
                      <td>{p.term ? `${p.term} ${p.timeUnit}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <table>
              <tbody>
                {totals.groups.map((g) => (
                  <tr key={g.vatCode}>
                    <td>SUBTOTAL {vatLabel(g.vatCode).toUpperCase()}</td>
                    <td className="num">{g.base.toFixed(2)}</td>
                  </tr>
                ))}
                <tr>
                  <td>SUBTOTAL SIN IMPUESTOS</td>
                  <td className="num">{totals.subtotal.toFixed(2)}</td>
                </tr>
                <tr>
                  <td>TOTAL DESCUENTO</td>
                  <td className="num">{totals.discount.toFixed(2)}</td>
                </tr>
                {totals.groups
                  .filter((g) => g.rate > 0)
                  .map((g) => (
                    <tr key={`iva-${g.vatCode}`}>
                      <td>{vatLabel(g.vatCode).toUpperCase()}</td>
                      <td className="num">{g.vat.toFixed(2)}</td>
                    </tr>
                  ))}
                <tr>
                  <td>PROPINA</td>
                  <td className="num">0.00</td>
                </tr>
                <tr>
                  <th>VALOR TOTAL</th>
                  <th className="num">{formatMoney(totals.total)}</th>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </>
  );
}
