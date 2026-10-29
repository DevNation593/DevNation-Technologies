import Link from "next/link";
import { dateInEcuador, formatDate } from "@/lib/admin/format";
import { getCertificateStatus } from "@/lib/sri/certificate";

/** Aviso en todas las páginas del panel cuando la firma vence en 30 días o menos, o ya caducó. */
export default async function CertificateBanner() {
  const certificate = await getCertificateStatus();
  if (!certificate.configured || !certificate.expiresSoon) return null;

  const date = formatDate(dateInEcuador(certificate.validTo));
  const days = certificate.daysLeft;
  const link = <Link href="/admin/configuracion">Configuración → Firma electrónica</Link>;

  return (
    <div className="adm-content" style={{ paddingBottom: 0 }}>
      {certificate.expired ? (
        <p className="notice danger" style={{ margin: 0 }}>
          La firma electrónica caducó el {date}. No puedes emitir facturas hasta subir una nueva. {link}
        </p>
      ) : (
        <p className="notice warning" style={{ margin: 0 }}>
          La firma electrónica{" "}
          {days === 0 ? "vence hoy" : days === 1 ? "vence mañana" : `vence en ${days} días`} ({date}). {link}
        </p>
      )}
    </div>
  );
}
