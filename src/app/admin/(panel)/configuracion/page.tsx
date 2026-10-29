import type { Metadata } from "next";
import PageHeader from "@/components/admin/PageHeader";
import { requireAdmin } from "@/lib/admin/auth";
import { formatDate } from "@/lib/admin/format";
import { getCompanySettings } from "@/lib/admin/server";
import { getCertificateStatus } from "@/lib/sri/certificate";
import { createClient } from "@/lib/supabase/server";
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

  return (
    <>
      <PageHeader title="Configuración" />
      <div className="adm-content">
        <section className="adm-card adm-card-pad" style={{ marginBottom: 16 }}>
          <h2>Firma electrónica</h2>
          {certificate.configured ? (
            <p className={certificate.expired ? "notice danger" : "notice success"} style={{ margin: "10px 0 0" }}>
              {certificate.expired ? "Firma CADUCADA" : "Firma cargada"}: <strong>{certificate.subject}</strong> · emitida por{" "}
              {certificate.issuer} · válida hasta {formatDate(certificate.validTo)}
            </p>
          ) : (
            <div className="notice warning" style={{ margin: "10px 0 0" }}>
              {certificate.error}
              <br />
              La firma se configura en variables de entorno del servidor (no se guarda en la base de datos):{" "}
              <code>SRI_P12_PATH</code> o <code>SRI_P12_BASE64</code>, y <code>SRI_P12_PASSWORD</code>.
            </div>
          )}
        </section>
        <InvoiceEmailForm settings={settings} hasApiKey={Boolean(process.env.RESEND_API_KEY?.trim())} />
        <SettingsForm
          settings={settings}
          nextSequential={Number(sequence.data?.last_value ?? 0) + 1}
        />
      </div>
    </>
  );
}
