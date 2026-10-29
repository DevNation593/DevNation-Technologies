"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { dateInEcuador, formatDate } from "@/lib/admin/format";
import { removeCertificate, sendCertificateTestEmail, uploadCertificate } from "./actions";

export default function CertificateForm({ hasUploaded }: { hasUploaded: boolean }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  const upload = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await uploadCertificate(formData);
      if (passwordRef.current) passwordRef.current.value = "";
      if (!result.ok) return setMessage({ text: result.error, error: true });
      formRef.current?.reset();
      setMessage({ text: `Firma cargada: ${result.subject}, válida hasta ${formatDate(dateInEcuador(result.validTo))}.` });
      router.refresh();
    });
  };

  const remove = () =>
    startTransition(async () => {
      setConfirmRemove(false);
      const result = await removeCertificate();
      setMessage(result.ok ? { text: "Firma electrónica quitada." } : { text: result.error, error: true });
      if (result.ok) router.refresh();
    });

  const sendTest = () =>
    startTransition(async () => {
      const result = await sendCertificateTestEmail();
      setMessage(
        result.ok
          ? { text: "Correo de prueba enviado a los administradores. Revisa tu bandeja en unos minutos." }
          : { text: result.error, error: true },
      );
    });

  return (
    <>
      <form ref={formRef} onSubmit={upload} style={{ marginTop: 14 }}>
        <div className="grid2">
          <label className="field">
            Archivo de la firma (.p12 o .pfx)
            <input type="file" name="p12" accept=".p12,.pfx" required />
          </label>
          <label className="field">
            Contraseña de la firma
            <input ref={passwordRef} type="password" name="password" autoComplete="off" maxLength={200} required />
          </label>
        </div>
        <p className="hint" style={{ marginTop: 0 }}>
          La firma y su contraseña se guardan cifradas y nunca se vuelven a mostrar.
        </p>
        {message && <p className={message.error ? "notice danger" : "notice success"}>{message.text}</p>}
        <div className="adm-actions" style={{ justifyContent: "flex-start" }}>
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "Procesando…" : hasUploaded ? "Reemplazar firma" : "Subir firma"}
          </button>
          {hasUploaded && (
            <button type="button" className="btn-secondary" onClick={() => setConfirmRemove(true)} disabled={pending}>
              Quitar firma
            </button>
          )}
          <button type="button" className="btn-ghost" onClick={sendTest} disabled={pending}>
            Enviar correo de prueba
          </button>
        </div>
      </form>
      <ConfirmDialog
        open={confirmRemove}
        title="Quitar firma electrónica"
        message="No podrás emitir facturas hasta subir otra firma (o configurarla en las variables del servidor)."
        confirmLabel="Quitar firma"
        tone="danger"
        onConfirm={remove}
        onCancel={() => setConfirmRemove(false)}
      />
    </>
  );
}
