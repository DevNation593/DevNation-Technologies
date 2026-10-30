"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ClientPicker from "@/components/admin/ClientPicker";
import CompanyLogo from "@/components/admin/CompanyLogo";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import PageHeader from "@/components/admin/PageHeader";
import { buildContract, clauseOptions, contractKinds, defaultContractData } from "@/lib/admin/contract-template";
import { formatDate, todayInEcuador } from "@/lib/admin/format";
import type { Client, CompanySettings, Contract, ContractData, ContractKind, ContractStatus } from "@/lib/admin/types";
import { deleteContract, saveContract, type ContractInput } from "./actions";

const statusOptions: { value: ContractStatus; label: string }[] = [
  { value: "borrador", label: "Borrador" },
  { value: "enviado", label: "Enviado para firma" },
  { value: "firmado", label: "Firmado" },
  { value: "finalizado", label: "Finalizado" },
  { value: "anulado", label: "Anulado" },
];

type TextField = Exclude<keyof ContractData, "clauses" | "price" | "months" | "notice">;

export default function ContractEditor({
  contract,
  settings,
  clients,
}: {
  contract: Contract | null;
  settings: CompanySettings;
  clients: Client[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<ContractInput>(() =>
    contract
      ? {
          kind: contract.kind,
          status: contract.status,
          contract_date: contract.contract_date,
          data: { ...defaultContractData(settings), ...contract.data },
        }
      : { kind: "software", status: "borrador", contract_date: todayInEcuador(), data: defaultContractData(settings) },
  );
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  const setData = (patch: Partial<ContractData>) => setForm((f) => ({ ...f, data: { ...f.data, ...patch } }));
  const input = (key: TextField, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="field">
      {label}
      <input value={form.data[key]} onChange={(e) => setData({ [key]: e.target.value })} {...props} />
    </label>
  );
  const area = (key: TextField, label: string, placeholder?: string) => (
    <label className="field">
      {label}
      <textarea value={form.data[key]} placeholder={placeholder} onChange={(e) => setData({ [key]: e.target.value })} />
    </label>
  );

  const doc = buildContract(form.kind, form.data, form.contract_date);

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await saveContract(contract?.id ?? null, form);
      if (!result.ok) return setMessage({ text: result.error, error: true });
      setMessage({ text: "Contrato guardado." });
      if (!contract) router.replace(`/admin/contratos/${result.id}`);
      else router.refresh();
    });
  }

  function remove() {
    if (!contract) return;
    startTransition(async () => {
      const result = await deleteContract(contract.id);
      if (!result.ok) return setMessage({ text: result.error, error: true });
      router.push("/admin/contratos");
    });
  }

  return (
    <>
      <PageHeader
        title={contract ? `Contrato ${contract.number}` : "Nuevo contrato"}
        crumbs={[{ href: "/admin/contratos", label: "Contratos" }]}
      >
        <button className="btn-primary" onClick={save} disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </button>
        <button className="btn-success" onClick={() => window.print()}>
          Imprimir / PDF
        </button>
      </PageHeader>

      <div className="adm-content">
        <div className="adm-workspace">
          <aside className="adm-card adm-editor">
            <h2>Generador de contratos</h2>
            <p className="intro">Completa los datos y personaliza las cláusulas. La vista legal se actualiza automáticamente.</p>
            <div className="notice">
              Plantillas orientativas para Ecuador. Revisa la identidad legal, impuestos, alcance, riesgos y firma con
              asesoría jurídica antes de utilizar el contrato.
            </div>
            {message && <p className={message.error ? "notice danger" : "notice success"}>{message.text}</p>}

            <div className="section-title">Documento</div>
            <label className="field">
              Tipo de contrato
              <select value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as ContractKind }))}>
                {contractKinds.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid2">
              <label className="field">
                Estado
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ContractStatus }))}
                >
                  {statusOptions.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Fecha de celebración
                <input
                  type="date"
                  value={form.contract_date}
                  onChange={(e) => setForm((f) => ({ ...f, contract_date: e.target.value }))}
                />
              </label>
            </div>
            {input("city", "Ciudad")}

            <div className="section-title">Prestador · DevNation</div>
            {input("provider", "Nombre o razón social legal")}
            {input("providerId", "RUC / Identificación", { placeholder: "RUC (pendiente de completar)" })}
            {input("providerRep", "Representante legal", { placeholder: "Nombre y apellido" })}
            {input("providerAddress", "Dirección de notificaciones")}
            {input("providerEmail", "Correo de contacto", { type: "email" })}

            <div className="section-title">Cliente / Contraparte</div>
            <ClientPicker
              clients={clients}
              onPick={(c) =>
                setData({
                  client: c.name,
                  clientId: c.identification,
                  clientRep: c.legal_representative,
                  clientAddress: c.address,
                  clientEmail: c.email,
                })
              }
            />
            {input("client", "Nombre o razón social", { placeholder: "Nombre de la empresa o cliente" })}
            {input("clientId", "RUC / Cédula")}
            {input("clientRep", "Representante legal", { placeholder: "Nombre y apellido" })}
            {input("clientAddress", "Dirección de notificaciones")}
            {input("clientEmail", "Correo", { type: "email" })}

            <div className="section-title">Servicio y condiciones</div>
            {input("project", "Proyecto / producto")}
            {area(
              "scope",
              "Alcance / servicios / entregables",
              "Describe con precisión alcance, entregables, exclusiones y requisitos de aceptación",
            )}
            <div className="grid2">
              <label className="field">
                Valor total USD
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.data.price}
                  onChange={(e) => setData({ price: Number(e.target.value) })}
                />
              </label>
              <label className="field">
                Duración en meses
                <input
                  type="number"
                  min={1}
                  value={form.data.months}
                  onChange={(e) => setData({ months: Number(e.target.value) })}
                />
              </label>
            </div>
            {area("payment", "Forma de pago")}
            {area("schedule", "Inicio / cronograma / hitos")}
            {area("sla", "Garantía / nivel de servicio (SLA)")}
            <label className="field">
              Plazo de preaviso de terminación (días)
              <input
                type="number"
                min={0}
                value={form.data.notice}
                onChange={(e) => setData({ notice: Number(e.target.value) })}
              />
            </label>

            <div className="section-title">Cláusulas configurables</div>
            {clauseOptions.map((c) => (
              <label key={c.key} className="check">
                <input
                  type="checkbox"
                  checked={form.data.clauses[c.key]}
                  onChange={(e) => setData({ clauses: { ...form.data.clauses, [c.key]: e.target.checked } })}
                />
                {c.label}
              </label>
            ))}

            <div className="section-title">Cláusula adicional</div>
            {input("customTitle", "Título", { placeholder: "Ej. Condiciones especiales" })}
            {area("customText", "Contenido", "Redacta aquí la cláusula adicional")}

            {doc.missing.length > 0 && (
              <p className="warn-text">Antes de firmar completa: {doc.missing.join(", ")}.</p>
            )}

            {contract && (
              <>
                <div className="section-title">Zona de riesgo</div>
                <button className="btn-danger" disabled={pending} onClick={() => setConfirmDelete(true)}>
                  Eliminar contrato
                </button>
              </>
            )}
          </aside>

          <main>
            <article className="doc-paper">
              <div className="contract-head">
                <div className="contract-corp">
                  <CompanyLogo src={settings.logo_url} className="contract-mark" />
                  <div>
                    <strong>{settings.nombre_comercial || settings.razon_social}</strong>
                    <span>SOFTWARE · CLOUD · CONSULTING</span>
                  </div>
                </div>
                <div className="contract-meta">
                  <div>N.º {contract?.number ?? "se asigna al guardar"}</div>
                  <div>{form.contract_date ? formatDate(form.contract_date) : "[fecha]"}</div>
                  <div>DOCUMENTO PRIVADO</div>
                </div>
              </div>
              <h1>{doc.title}</h1>
              <p className="contract-subtitle">Acuerdo comercial · República del Ecuador</p>
              <section className="contract-body">
                <p>{doc.introduction}</p>
                {doc.sections.map((s) => (
                  <div key={s.heading}>
                    <h3>{s.heading}</h3>
                    <p>{s.body}</p>
                  </div>
                ))}
                <p>{doc.closing}</p>
              </section>
              <div className="contract-signatures">
                <div>
                  <strong>{form.data.provider || "[razón social del prestador]"}</strong>
                  {form.data.providerRep || "[Representante autorizado]"}
                  <br />
                  {form.data.providerId || "[Identificación]"}
                  <br />
                  EL PRESTADOR
                </div>
                <div>
                  <strong>{form.data.client || "[nombre de la contraparte]"}</strong>
                  {form.data.clientRep || "[Representante autorizado]"}
                  <br />
                  {form.data.clientId || "[Identificación]"}
                  <br />
                  EL CLIENTE / CONTRAPARTE
                </div>
              </div>
              <footer className="contract-foot">
                <span>{(settings.nombre_comercial || settings.razon_social).toUpperCase()} · DOCUMENTO CONFIDENCIAL</span>
                <span>{contract?.number}</span>
              </footer>
            </article>
          </main>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Eliminar contrato"
        message={`Se eliminará el contrato ${contract?.number}. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        tone="danger"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          remove();
        }}
      />
    </>
  );
}
