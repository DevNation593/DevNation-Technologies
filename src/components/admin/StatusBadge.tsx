const styles: Record<string, { label: string; tone: string }> = {
  borrador: { label: "Borrador", tone: "" },
  enviada: { label: "Enviada", tone: "blue" },
  enviado: { label: "Enviado", tone: "blue" },
  aceptada: { label: "Aceptada", tone: "green" },
  rechazada: { label: "Rechazada", tone: "red" },
  facturada: { label: "Facturada", tone: "purple" },
  firmado: { label: "Firmado", tone: "green" },
  finalizado: { label: "Finalizado", tone: "purple" },
  anulado: { label: "Anulado", tone: "red" },
  autorizada: { label: "Autorizada", tone: "green" },
  devuelta: { label: "Devuelta", tone: "amber" },
  no_autorizada: { label: "No autorizada", tone: "red" },
  anulada: { label: "Anulada", tone: "red" },
};

/** Para facturas "enviada" significa recibida por el SRI y pendiente de autorización. */
export default function StatusBadge({ status, invoice = false }: { status: string; invoice?: boolean }) {
  const style = styles[status] ?? { label: status, tone: "" };
  const label = invoice && status === "enviada" ? "En proceso SRI" : style.label;
  return <span className={`badge ${invoice && status === "enviada" ? "amber" : style.tone}`}>{label}</span>;
}
