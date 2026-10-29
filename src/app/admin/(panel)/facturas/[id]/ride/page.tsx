import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Barcode from "@/components/admin/Barcode";
import CompanyLogo from "@/components/admin/CompanyLogo";
import PageHeader from "@/components/admin/PageHeader";
import PrintButton from "@/components/admin/PrintButton";
import { requireAdmin } from "@/lib/admin/auth";
import { getCompanySettings } from "@/lib/admin/server";
import type { Invoice } from "@/lib/admin/types";
import { buildRideData } from "@/lib/sri/ride";
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
  const ride = buildRideData(invoice, settings);

  return (
    <>
      <PageHeader
        title={`RIDE ${ride.number}`}
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
        {!ride.authorized && (
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
                  <strong style={{ fontSize: 14 }}>{ride.issuer.razonSocial}</strong>
                </p>
                {ride.issuer.nombreComercial && <p>{ride.issuer.nombreComercial}</p>}
                {ride.issuer.rows.map((row) =>
                  row.label ? (
                    <p key={row.label}>
                      <strong>{row.label}:</strong> {row.value}
                    </p>
                  ) : (
                    <p key={row.value}>{row.value}</p>
                  ),
                )}
              </div>
            </div>
            <div className="ride-box">
              <p>
                <strong>R.U.C.:</strong> {ride.issuer.ruc}
              </p>
              <h2>FACTURA</h2>
              <p>
                <strong>No.</strong> {ride.number}
              </p>
              <p>
                <strong>NÚMERO DE AUTORIZACIÓN</strong>
              </p>
              <p className="key">{ride.authorizationNumber}</p>
              <p>
                <strong>FECHA Y HORA DE AUTORIZACIÓN:</strong> {ride.authorizedAt}
              </p>
              <p>
                <strong>AMBIENTE:</strong> {ride.environment}
              </p>
              <p>
                <strong>EMISIÓN:</strong> NORMAL
              </p>
              <p>
                <strong>CLAVE DE ACCESO</strong>
              </p>
              <div className="barcode">
                <Barcode value={ride.accessKey} />
              </div>
              <p className="key">{ride.accessKey}</p>
            </div>
          </div>
          <div className="ride-box" style={{ marginTop: 12 }}>
            <p>
              <strong>Razón social / Nombres y apellidos:</strong> {ride.buyer.name}
            </p>
            <p>
              <strong>{ride.buyer.idLabel}:</strong> {ride.buyer.identification}
              <span style={{ marginLeft: 24 }}>
                <strong>Fecha de emisión:</strong> {ride.issueDate}
              </span>
            </p>
            {ride.buyer.address && (
              <p>
                <strong>Dirección:</strong> {ride.buyer.address}
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
              {ride.lines.map((line, i) => (
                <tr key={i}>
                  <td>{line.code}</td>
                  <td className="num">{line.quantity}</td>
                  <td>{line.description}</td>
                  <td className="num">{line.unitPrice}</td>
                  <td className="num">{line.discount}</td>
                  <td className="num">{line.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="ride-bottom">
            <div>
              {ride.additionalInfo.length > 0 && (
                <table>
                  <thead>
                    <tr>
                      <th colSpan={2}>Información adicional</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ride.additionalInfo.map((f) => (
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
                  {ride.payments.map((p, i) => (
                    <tr key={i}>
                      <td>{p.label}</td>
                      <td className="num">{p.amount}</td>
                      <td>{p.term}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <table>
              <tbody>
                {ride.totals.map((row) =>
                  row.strong ? (
                    <tr key={row.label}>
                      <th>{row.label}</th>
                      <th className="num">{row.value}</th>
                    </tr>
                  ) : (
                    <tr key={row.label}>
                      <td>{row.label}</td>
                      <td className="num">{row.value}</td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </>
  );
}
