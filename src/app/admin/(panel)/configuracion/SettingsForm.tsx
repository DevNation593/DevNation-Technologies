"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import CompanyLogo from "@/components/admin/CompanyLogo";
import type { CompanySettings } from "@/lib/admin/types";
import { regimes, type Regime } from "@/lib/sri/catalogs";
import { saveSettings, setNextInvoiceSequential } from "./actions";

type TextKey = Exclude<
  { [K in keyof CompanySettings]-?: CompanySettings[K] extends string ? K : never }[keyof CompanySettings],
  "updated_at" | "regimen"
>;

export default function SettingsForm({
  settings,
  nextSequential,
}: {
  settings: CompanySettings;
  nextSequential: number;
}) {
  const router = useRouter();
  const [form, setForm] = useState(settings);
  const [sequential, setSequential] = useState(nextSequential);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  const field = (key: TextKey, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="field">
      {label}
      <input value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} {...props} />
    </label>
  );

  function loadLogo(file: File | undefined) {
    if (!file) return;
    if (file.size > 300_000) return setMessage({ text: "El logo debe pesar máximo 300 KB.", error: true });
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, logo_data_url: String(reader.result) }));
    reader.readAsDataURL(file);
  }

  const save = () =>
    startTransition(async () => {
      const result = await saveSettings(form);
      setMessage(result.ok ? { text: "Configuración guardada." } : { text: result.error, error: true });
      if (result.ok) router.refresh();
    });

  const saveSequential = () =>
    startTransition(async () => {
      const result = await setNextInvoiceSequential(settings.ambiente, settings.estab, settings.pto_emi, sequential);
      setMessage(result.ok ? { text: "Secuencial actualizado." } : { text: result.error, error: true });
      if (result.ok) router.refresh();
    });

  return (
    <div className="adm-two">
      <section className="adm-card adm-card-pad">
        <h2>Datos del emisor</h2>
        <p className="hint" style={{ marginTop: 0 }}>
          Se usan en facturas (deben coincidir con el RUC en el SRI), cotizaciones y contratos.
        </p>
        {message && <p className={message.error ? "notice danger" : "notice success"}>{message.text}</p>}

        <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 12 }}>
          <CompanyLogo src={form.logo_data_url} />
          <div style={{ flex: 1 }}>
            <label className="field" style={{ marginBottom: 4 }}>
              Logo
              <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => loadLogo(e.target.files?.[0])} />
            </label>
            {form.logo_data_url && (
              <button className="btn-ghost btn-sm" onClick={() => setForm((f) => ({ ...f, logo_data_url: "" }))}>
                Quitar logo
              </button>
            )}
          </div>
        </div>

        {field("ruc", "RUC", { inputMode: "numeric", maxLength: 13, placeholder: "17XXXXXXXX001" })}
        {field("razon_social", "Razón social (como consta en el RUC)")}
        {field("nombre_comercial", "Nombre comercial")}
        {field("dir_matriz", "Dirección matriz")}
        {field("dir_establecimiento", "Dirección del establecimiento (opcional)")}
        <div className="grid2">
          {field("representante_legal", "Representante legal")}
          {field("ciudad", "Ciudad")}
        </div>
        <div className="grid2">
          {field("email", "Email", { type: "email" })}
          {field("telefono", "Teléfono")}
        </div>

        <div className="section-title">Información tributaria</div>
        <label className="field">
          Régimen
          <select value={form.regimen} onChange={(e) => setForm((f) => ({ ...f, regimen: e.target.value as Regime }))}>
            {regimes.map((r) => (
              <option key={r.code} value={r.code}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={form.obligado_contabilidad}
            onChange={(e) => setForm((f) => ({ ...f, obligado_contabilidad: e.target.checked }))}
          />
          Obligado a llevar contabilidad
        </label>
        <div className="grid2">
          {field("contribuyente_especial", "N.º contribuyente especial", { placeholder: "Opcional" })}
          {field("agente_retencion", "Resolución agente de retención", { placeholder: "Opcional" })}
        </div>

        <button className="btn-primary" onClick={save} disabled={pending} style={{ marginTop: 8 }}>
          {pending ? "Guardando…" : "Guardar configuración"}
        </button>
      </section>

      <div>
        <section className="adm-card adm-card-pad" style={{ marginBottom: 16 }}>
          <h2>Facturación electrónica</h2>
          <p className="hint" style={{ marginTop: 0 }}>
            Primero emite en pruebas. Cambia a producción solo cuando el SRI haya habilitado tu RUC.
          </p>
          <label className="field">
            Ambiente
            <select
              value={form.ambiente}
              onChange={(e) => setForm((f) => ({ ...f, ambiente: Number(e.target.value) === 2 ? 2 : 1 }))}
            >
              <option value={1}>Pruebas (celcer.sri.gob.ec)</option>
              <option value={2}>Producción (cel.sri.gob.ec)</option>
            </select>
          </label>
          <div className="grid2">
            {field("estab", "Establecimiento", { inputMode: "numeric", maxLength: 3 })}
            {field("pto_emi", "Punto de emisión", { inputMode: "numeric", maxLength: 3 })}
          </div>
          {form.ambiente === 2 && settings.ambiente === 1 && (
            <p className="notice warning">Al guardar, las nuevas facturas se emitirán en PRODUCCIÓN con validez tributaria.</p>
          )}
          <button className="btn-primary" onClick={save} disabled={pending}>
            Guardar
          </button>
        </section>

        <section className="adm-card adm-card-pad">
          <h2>Secuencial de facturas</h2>
          <p className="hint" style={{ marginTop: 0 }}>
            Serie {settings.estab}-{settings.pto_emi} en {settings.ambiente === 2 ? "producción" : "pruebas"}. Ajústalo si ya
            emitiste facturas desde otro sistema.
          </p>
          <label className="field">
            Próximo secuencial
            <input type="number" min={1} value={sequential} onChange={(e) => setSequential(Number(e.target.value))} />
          </label>
          <button className="btn-secondary" onClick={saveSequential} disabled={pending || sequential === nextSequential}>
            Actualizar secuencial
          </button>
        </section>
      </div>
    </div>
  );
}
