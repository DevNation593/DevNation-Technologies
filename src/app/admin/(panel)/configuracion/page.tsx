import type { Metadata } from "next";
import PageHeader from "@/components/admin/PageHeader";
import { requireAdmin } from "@/lib/admin/auth";
import { dateInEcuador, formatDate } from "@/lib/admin/format";
import { getCompanySettings } from "@/lib/admin/server";
import { getCertificateStatus } from "@/lib/sri/certificate";
import { readSmtpConfig } from "@/lib/sri/invoice-email";
import { createClient } from "@/lib/supabase/server";
import CertificateForm from "./CertificateForm";
import InvoiceEmailForm from "./InvoiceEmailForm";
import SettingsForm from "./SettingsForm";

export const metadata: Metadata = { title: "Configuración" };

export default async function SettingsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const settings = await getCompanySettings(supabase);
  const [certificate, sequence] = await Promise.all([
    getCertificateStatus(),
    supabase
      .from("document_sequences")
      .select("last_value")
      .eq("key", `factura:${settings.ambiente}:${settings.estab}-${settings.pto_emi}`)
      .maybeSingle(),
  ]);
  // Solo el host y los nombres de variables que faltan llegan al navegador, nunca las credenciales.
  const smtp = readSmtpConfig();
  const smtpStatus = "config" in smtp ? { host: smtp.config.host, missing: [] } : { host: "", missing: smtp.missing };

  return (
    <>
      <PageHeader title="Configuración" />
      <div className="adm-content">
        <section className="adm-card adm-card-pad" style={{ marginBottom: 16 }}>
          <h2>Firma electrónica</h2>
          {certificate.configured ? (
            <p className={certificate.expired ? "notice danger" : "notice success"} style={{ margin: "10px 0 0" }}>
              {certificate.expired ? "Firma CADUCADA" : "Firma cargada"}: <strong>{certificate.subject}</strong> · emitida por{" "}
              {certificate.issuer} · válida del {formatDate(dateInEcuador(certificate.validFrom))} al{" "}
              {formatDate(dateInEcuador(certificate.validTo))}
              {!certificate.expired && ` (${certificate.daysLeft === 1 ? "queda 1 día" : `quedan ${certificate.daysLeft} días`})`}
              {" · "}
              {certificate.source === "panel" ? "Subida en el panel" : "Variables de entorno"}
            </p>
          ) : (
            <p className="notice warning" style={{ margin: "10px 0 0" }}>
              {certificate.error}
            </p>
          )}
          <CertificateForm hasUploaded={certificate.configured && certificate.source === "panel"} />
        </section>
        <InvoiceEmailForm settings={settings} smtp={smtpStatus} />
        <SettingsForm
          settings={settings}
          nextSequential={Number(sequence.data?.last_value ?? 0) + 1}
        />
      </div>
    </>
  );
}
