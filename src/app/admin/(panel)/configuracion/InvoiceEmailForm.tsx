"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CompanySettings } from "@/lib/admin/types";
import { saveInvoiceEmailSettings } from "./actions";

export default function InvoiceEmailForm({
  settings,
  hasApiKey,
}: {
  settings: CompanySettings;
  hasApiKey: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    enabled: settings.invoice_email_enabled,
    from: settings.invoice_email_from,
    replyTo: settings.invoice_email_reply_to,
    bcc: settings.invoice_email_bcc,
  });
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const logoSupported = !settings.logo_data_url || /^data:image\/(png|jpeg);base64,/.test(settings.logo_data_url);

  const save = () =>
    startTransition(async () => {
      const result = await saveInvoiceEmailSettings(form);
      setMessage(result.ok ? { text: "Correo de facturación guardado." } : { text: result.error, error: true });
      if (result.ok) router.refresh();
    });

  const field = (key: "from" | "replyTo" | "bcc", label: string, placeholder: string) => (
    <label className="field">
      {label}
      <input
        value={form[key]}
        placeholder={placeholder}
        maxLength={200}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      />
    </label>
  );

  return (
    <section className="adm-card adm-card-pad" style={{ marginBottom: 16 }}>
      <h2>Correo de facturación</h2>
      <p className="hint" style={{ marginTop: 0 }}>
        Cada factura autorizada se envía al comprador con el RIDE en PDF y el XML autorizado.
      </p>
      <p className={hasApiKey ? "notice success" : "notice warning"}>
        {hasApiKey ? "API key de Resend: configurada" : "Falta RESEND_API_KEY en las variables del servidor."}
      </p>
      {!logoSupported && (
        <p className="notice warning">El logo no es PNG ni JPG: el PDF de las facturas saldrá sin logo.</p>
      )}
      {message && <p className={message.error ? "notice danger" : "notice success"}>{message.text}</p>}
      <label className="check">
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
        />
        Enviar automáticamente cada factura autorizada al comprador
      </label>
      {field("from", "Remitente", "DevNation Facturación <facturacion@devnation.tech>")}
      <div className="grid2">
        {field("replyTo", "Responder a", "contacto@devnation.tech")}
        {field("bcc", "Copia oculta (tu archivo)", "archivo@devnation.tech")}
      </div>
      <button className="btn-primary" onClick={save} disabled={pending}>
        {pending ? "Guardando…" : "Guardar correo"}
      </button>
    </section>
  );
}
