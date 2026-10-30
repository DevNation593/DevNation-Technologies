"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ClientPicker from "@/components/admin/ClientPicker";
import CompanyLogo from "@/components/admin/CompanyLogo";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import PageHeader from "@/components/admin/PageHeader";
import ProductPicker from "@/components/admin/ProductPicker";
import StatusBadge from "@/components/admin/StatusBadge";
import { formatDate, formatDateTime, formatMoney, invoiceNumber, todayInEcuador } from "@/lib/admin/format";
import type { Client, CompanySettings, Invoice, InvoicePayment, Product, SriMessage } from "@/lib/admin/types";
import {
  FINAL_CONSUMER_ID,
  FINAL_CONSUMER_NAME,
  environments,
  identificationTypes,
  paymentMethods,
  vatLabel,
  vatRates,
  type IdentificationType,
} from "@/lib/sri/catalogs";
import { computeInvoiceTotals, type InvoiceItem } from "@/lib/sri/totals";
import { validateInvoice, validateIssuer } from "@/lib/sri/validate";
import {
  checkAuthorization,
  deleteInvoice,
  emitInvoice,
  markInvoiceVoided,
  resendInvoiceEmail,
  saveInvoice,
  type AuthorizationResult,
  type InvoiceInput,
} from "./actions";

/** Texto que se añade al resultado de emitir o consultar según el envío automático por correo. */
function emailNote(result: AuthorizationResult): string {
  if (!result.email) return "";
  if (!result.email.sent) return ` No se pudo enviar el correo: ${result.email.error.replace(/\.$/, "")}.`;
  return ` Enviada por correo a ${result.email.to.join(", ")}.${rejectedNote(result.email.rejected)}`;
}

/** Aviso de los destinatarios que el servidor SMTP rechazó y requieren reenvío. */
function rejectedNote(rejected: string[]): string {
  return rejected.length ? ` No se pudo entregar a ${rejected.join(", ")}: reenvíala a esas direcciones.` : "";
}

/** El aviso del resultado es de advertencia si el correo falló o algún destinatario fue rechazado. */
function emailWarning(result: AuthorizationResult): boolean {
  return Boolean(result.email && (!result.email.sent || result.email.rejected.length > 0));
}

const EDITABLE = ["borrador", "devuelta", "no_autorizada"];

const emptyItem = (): InvoiceItem => ({ code: "", description: "", quantity: 1, unitPrice: 0, discount: 0, vatCode: "4" });

/** Un ítem sin datos (el que trae una factura nueva) se reemplaza al agregar un producto. */
const isBlankItem = (it: InvoiceItem) => !it.code.trim() && !it.description.trim() && !it.unitPrice && !it.discount;

function initialState(invoice: Invoice | null): InvoiceInput {
  if (invoice) {
    return {
      buyer: invoice.buyer,
      items: invoice.items.length ? invoice.items : [emptyItem()],
      payments: invoice.payments,
      additional_info: invoice.additional_info,
      issue_date: invoice.issue_date,
    };
  }
  return {
    buyer: { identificationType: "04", identification: "", name: "", address: "", email: "", phone: "" },
    items: [emptyItem()],
    payments: [{ method: "20", amount: 0, term: null, timeUnit: "" }],
    additional_info: [{ name: "Email", value: "" }],
    issue_date: todayInEcuador(),
  };
}

function Messages({ messages }: { messages: SriMessage[] }) {
  if (!messages.length) return null;
  return (
    <ul className="sri-messages">
      {messages.map((m, i) => (
        <li key={i}>
          <strong>
            {m.identificador} · {m.tipo}
          </strong>{" "}
          {m.mensaje}
          {m.informacionAdicional && <div>{m.informacionAdicional}</div>}
        </li>
      ))}
    </ul>
  );
}

export default function InvoiceEditor({
  invoice,
  settings,
  clients,
  products,
  certificateReady,
}: {
  invoice: Invoice | null;
  settings: CompanySettings;
  clients: Client[];
  products: Product[];
  certificateReady: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState<InvoiceInput>(() => initialState(invoice));
  const [message, setMessage] = useState<{ text: string; tone: "success" | "danger" | "warning" } | null>(null);
  const [dialog, setDialog] = useState<"emit" | "delete" | "void" | "email" | null>(null);
  const [recipients, setRecipients] = useState("");
  const [pending, startTransition] = useTransition();

  const status = invoice?.status ?? "borrador";
  const editable = EDITABLE.includes(status);
  const numbered = Boolean(invoice?.access_key) && status !== "no_autorizada";
  const environment = (invoice?.ambiente ?? settings.ambiente) as 1 | 2;

  const totals = computeInvoiceTotals(form.items);
  const issues = [...validateIssuer(settings), ...validateInvoice(form, todayInEcuador())];

  const update = (patch: Partial<InvoiceInput>) =>
    setForm((f) => {
      const next = { ...f, ...patch };
      // Con una sola forma de pago, su monto sigue al total de la factura.
      if (next.payments.length === 1) {
        next.payments = [{ ...next.payments[0], amount: computeInvoiceTotals(next.items).total }];
      }
      return next;
    });
  const setBuyer = (patch: Partial<InvoiceInput["buyer"]>) => update({ buyer: { ...form.buyer, ...patch } });
  const setItem = (i: number, patch: Partial<InvoiceItem>) =>
    update({ items: form.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });
  const addProduct = (p: Product) => {
    const item: InvoiceItem = {
      code: p.code,
      description: p.description,
      quantity: 1,
      unitPrice: p.unit_price,
      discount: 0,
      vatCode: p.vat_code,
    };
    const items = form.items.filter((it) => !isBlankItem(it));
    update({ items: [...items, item] });
  };
  const setPayment = (i: number, patch: Partial<InvoicePayment>) =>
    update({ payments: form.payments.map((p, idx) => (idx === i ? { ...p, ...patch } : p)) });
  const setInfo = (i: number, patch: Partial<{ name: string; value: string }>) =>
    update({ additional_info: form.additional_info.map((f, idx) => (idx === i ? { ...f, ...patch } : f)) });

  function setIdentificationType(type: IdentificationType) {
    if (type === "07") {
      setBuyer({ identificationType: type, identification: FINAL_CONSUMER_ID, name: FINAL_CONSUMER_NAME });
    } else {
      setBuyer({
        identificationType: type,
        ...(form.buyer.identificationType === "07" ? { identification: "", name: "" } : {}),
      });
    }
  }

  function pickClient(c: Client) {
    const info = form.additional_info.filter((f) => f.name !== "Email" && f.name !== "Teléfono");
    update({
      buyer: {
        identificationType: c.identification_type,
        identification: c.identification,
        name: c.name,
        address: c.address,
        email: c.email,
        phone: c.phone,
      },
      additional_info: [
        ...(c.email ? [{ name: "Email", value: c.email }] : []),
        ...(c.phone ? [{ name: "Teléfono", value: c.phone }] : []),
        ...info,
      ],
    });
  }

  async function persist(): Promise<string | null> {
    const result = await saveInvoice(invoice?.id ?? null, form);
    if (!result.ok) {
      setMessage({ text: result.error, tone: "danger" });
      return null;
    }
    return result.id;
  }

  const save = () =>
    startTransition(async () => {
      setMessage(null);
      const id = await persist();
      if (!id) return;
      setMessage({ text: "Factura guardada.", tone: "success" });
      if (!invoice) router.replace(`/admin/facturas/${id}`);
      else router.refresh();
    });

  const emit = () =>
    startTransition(async () => {
      setMessage(null);
      const id = await persist();
      if (!id) return;
      const result = await emitInvoice(id);
      if (!result.ok) setMessage({ text: result.error, tone: "danger" });
      else if (result.status === "autorizada")
        setMessage({
          text: `Factura AUTORIZADA por el SRI.${emailNote(result)}`,
          tone: emailWarning(result) ? "warning" : "success",
        });
      else if (result.status === "enviada")
        setMessage({ text: "El SRI recibió la factura y la está procesando. Consulta la autorización en unos minutos.", tone: "warning" });
      else setMessage({ text: "El SRI rechazó la factura. Revisa los mensajes, corrige y vuelve a emitir.", tone: "danger" });
      if (!invoice) router.replace(`/admin/facturas/${id}`);
      else router.refresh();
    });

  const refresh = () =>
    startTransition(async () => {
      if (!invoice) return;
      const result = await checkAuthorization(invoice.id);
      if (!result.ok) setMessage({ text: result.error, tone: "danger" });
      else
        setMessage({
          text: `Estado en el SRI: ${result.status.replace("_", " ")}.${emailNote(result)}`,
          tone: emailWarning(result) ? "warning" : "success",
        });
      router.refresh();
    });

  const sendEmail = () =>
    startTransition(async () => {
      if (!invoice) return;
      setDialog(null);
      const result = await resendInvoiceEmail(invoice.id, recipients);
      setMessage(
        result.ok
          ? {
              text: `Factura enviada a ${result.to.join(", ")}.${rejectedNote(result.rejected)}`,
              tone: result.rejected.length ? "warning" : "success",
            }
          : { text: result.error, tone: "danger" },
      );
      router.refresh();
    });

  const voidInvoice = () =>
    startTransition(async () => {
      if (!invoice) return;
      const result = await markInvoiceVoided(invoice.id);
      if (!result.ok) setMessage({ text: result.error, tone: "danger" });
      router.refresh();
    });

  const remove = () =>
    startTransition(async () => {
      if (!invoice) return;
      const result = await deleteInvoice(invoice.id);
      if (!result.ok) return setMessage({ text: result.error, tone: "danger" });
      router.push("/admin/facturas");
    });

  const ro = !editable;

  return (
    <>
      <PageHeader
        title={invoice ? `Factura ${invoiceNumber(invoice.estab, invoice.pto_emi, invoice.secuencial)}` : "Nueva factura"}
        crumbs={[{ href: "/admin/facturas", label: "Facturación" }]}
      >
        {invoice?.access_key && (
          <>
            <Link className="btn btn-secondary" href={`/admin/facturas/${invoice.id}/ride`}>
              RIDE / PDF
            </Link>
            {(status === "autorizada" || status === "anulada") && (
              <a className="btn btn-secondary" href={`/admin/facturas/${invoice.id}/pdf`} target="_blank" rel="noreferrer">
                Descargar PDF
              </a>
            )}
            {(invoice.authorized_xml_path || invoice.signed_xml_path || invoice.authorized_xml || invoice.signed_xml) && (
              <a className="btn btn-secondary" href={`/admin/facturas/${invoice.id}/xml`}>
                Descargar XML
              </a>
            )}
          </>
        )}
        {status === "autorizada" && (
          <button
            className="btn-secondary"
            onClick={() => {
              // El correo guardado puede haber cambiado desde que se abrió el editor (p. ej. al
              // cambiar de comprador y emitir sin salir de la pantalla).
              setRecipients(invoice?.buyer.email.trim() ?? "");
              setDialog("email");
            }}
            disabled={pending}
          >
            Reenviar por correo
          </button>
        )}
        {status === "enviada" && (
          <button className="btn-secondary" onClick={refresh} disabled={pending}>
            Consultar autorización
          </button>
        )}
        {editable && (
          <>
            <button className="btn-secondary" onClick={save} disabled={pending}>
              Guardar borrador
            </button>
            <button
              className="btn-accent"
              onClick={() => setDialog("emit")}
              disabled={pending || issues.length > 0 || !certificateReady}
              title={!certificateReady ? "Configura la firma electrónica" : issues[0]}
            >
              {pending ? "Procesando…" : "Emitir al SRI"}
            </button>
          </>
        )}
      </PageHeader>

      <div className="adm-content">
        <div className="adm-workspace">
          <aside className="adm-card adm-editor">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <h2>Factura electrónica</h2>
              <StatusBadge status={status} invoice />
            </div>
            <p className="intro">
              Ambiente: <strong>{environments[environment]}</strong>
              {invoice?.access_key && (
                <>
                  <br />
                  Clave: <span style={{ fontFamily: "monospace", fontSize: 11, overflowWrap: "anywhere" }}>{invoice.access_key}</span>
                </>
              )}
              {invoice?.authorized_at && (
                <>
                  <br />
                  Autorizada: {formatDateTime(invoice.authorized_at)}
                </>
              )}
              {invoice?.last_emailed_at && (
                <>
                  <br />
                  Enviada por correo a {invoice.last_emailed_to} el {formatDateTime(invoice.last_emailed_at)}
                </>
              )}
            </p>
            {invoice?.last_email_error && (
              <p className="notice danger">No se pudo enviar el correo: {invoice.last_email_error}</p>
            )}

            {environment === 1 && (
              <p className="notice warning">
                Ambiente de PRUEBAS: los comprobantes no tienen validez tributaria. Cambia a producción en Configuración.
              </p>
            )}
            {!certificateReady && editable && (
              <p className="notice danger">
                Falta la firma electrónica (.p12). <Link href="/admin/configuracion">Ver configuración</Link>
              </p>
            )}
            {message && <p className={`notice ${message.tone}`}>{message.text}</p>}
            {invoice && invoice.sri_messages.length > 0 && status !== "autorizada" && (
              <Messages messages={invoice.sri_messages} />
            )}
            {editable && issues.length > 0 && (
              <div className="notice warning">
                <strong>Antes de emitir:</strong>
                <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                  {issues.slice(0, 6).map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}

            <fieldset disabled={ro} style={{ border: 0, padding: 0, margin: 0 }}>
              <div className="section-title">Comprador</div>
              {editable && <ClientPicker clients={clients} onPick={pickClient} />}
              <label className="field">
                Tipo de identificación
                <select
                  value={form.buyer.identificationType}
                  onChange={(e) => setIdentificationType(e.target.value as IdentificationType)}
                >
                  {identificationTypes.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Identificación
                <input
                  value={form.buyer.identification}
                  readOnly={form.buyer.identificationType === "07"}
                  onChange={(e) => setBuyer({ identification: e.target.value })}
                />
              </label>
              <label className="field">
                Razón social / Nombres
                <input value={form.buyer.name} onChange={(e) => setBuyer({ name: e.target.value })} />
              </label>
              <label className="field">
                Dirección
                <input value={form.buyer.address} onChange={(e) => setBuyer({ address: e.target.value })} />
              </label>
              <div className="grid2">
                <label className="field">
                  Email
                  <input value={form.buyer.email} onChange={(e) => setBuyer({ email: e.target.value })} />
                  {editable && !form.buyer.email.trim() && (
                    <span className="hint">Sin correo, la factura autorizada no se enviará al comprador.</span>
                  )}
                </label>
                <label className="field">
                  Teléfono
                  <input value={form.buyer.phone} onChange={(e) => setBuyer({ phone: e.target.value })} />
                </label>
              </div>

              <div className="section-title">Emisión</div>
              <label className="field">
                Fecha de emisión
                <input
                  type="date"
                  value={form.issue_date}
                  max={todayInEcuador()}
                  disabled={numbered}
                  onChange={(e) => update({ issue_date: e.target.value })}
                />
              </label>

              <div className="section-title">Formas de pago</div>
              {form.payments.map((p, i) => (
                <div key={i} className="adm-card" style={{ padding: 10, marginBottom: 8, boxShadow: "none" }}>
                  <label className="field">
                    Forma de pago
                    <select value={p.method} onChange={(e) => setPayment(i, { method: e.target.value })}>
                      {paymentMethods.map((m) => (
                        <option key={m.code} value={m.code}>
                          {m.code} · {m.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid3">
                    <label className="field">
                      Monto
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={p.amount}
                        readOnly={form.payments.length === 1}
                        onChange={(e) => setPayment(i, { amount: Number(e.target.value) })}
                      />
                    </label>
                    <label className="field">
                      Plazo
                      <input
                        type="number"
                        min={0}
                        value={p.term ?? ""}
                        onChange={(e) => setPayment(i, { term: e.target.value ? Number(e.target.value) : null })}
                      />
                    </label>
                    <label className="field">
                      Unidad
                      <select value={p.timeUnit} onChange={(e) => setPayment(i, { timeUnit: e.target.value })}>
                        <option value="">—</option>
                        <option value="dias">Días</option>
                        <option value="meses">Meses</option>
                      </select>
                    </label>
                  </div>
                  {form.payments.length > 1 && (
                    <button
                      className="btn-ghost btn-sm"
                      onClick={() => update({ payments: form.payments.filter((_, idx) => idx !== i) })}
                    >
                      Quitar
                    </button>
                  )}
                </div>
              ))}
              {editable && (
                <button
                  className="btn-secondary btn-sm"
                  onClick={() =>
                    update({ payments: [...form.payments, { method: "20", amount: 0, term: null, timeUnit: "" }] })
                  }
                >
                  + Forma de pago
                </button>
              )}

              <div className="section-title">Información adicional</div>
              {form.additional_info.map((f, i) => (
                <div key={i} className="grid2" style={{ alignItems: "end" }}>
                  <label className="field">
                    Campo
                    <input value={f.name} onChange={(e) => setInfo(i, { name: e.target.value })} />
                  </label>
                  <label className="field">
                    Valor
                    <div style={{ display: "flex", gap: 4 }}>
                      <input value={f.value} onChange={(e) => setInfo(i, { value: e.target.value })} />
                      {editable && (
                        <button
                          className="btn-ghost btn-sm"
                          aria-label="Quitar campo"
                          style={{ marginTop: 5 }}
                          onClick={() => update({ additional_info: form.additional_info.filter((_, idx) => idx !== i) })}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </label>
                </div>
              ))}
              {editable && form.additional_info.length < 15 && (
                <button
                  className="btn-secondary btn-sm"
                  onClick={() => update({ additional_info: [...form.additional_info, { name: "", value: "" }] })}
                >
                  + Campo adicional
                </button>
              )}
            </fieldset>

            {invoice && (
              <>
                <div className="section-title">Acciones</div>
                <div className="adm-actions">
                  {status === "autorizada" && (
                    <button className="btn-danger btn-sm" disabled={pending} onClick={() => setDialog("void")}>
                      Marcar como anulada
                    </button>
                  )}
                  {!invoice.access_key && (
                    <button className="btn-danger btn-sm" disabled={pending} onClick={() => setDialog("delete")}>
                      Eliminar borrador
                    </button>
                  )}
                </div>
              </>
            )}
          </aside>

          <main className="doc-sheet">
            <div className="doc-head">
              <div className="doc-company">
                <CompanyLogo src={settings.logo_url} />
                <div>
                  <h1>{settings.razon_social}</h1>
                  <p>
                    {[settings.ruc && `RUC: ${settings.ruc}`, settings.dir_matriz].filter(Boolean).join(" · ")}
                    {settings.obligado_contabilidad ? " · Obligado a llevar contabilidad" : ""}
                  </p>
                </div>
              </div>
              <div className="doc-title">
                <h2>FACTURA</h2>
                <p className="kicker">Comprobante electrónico</p>
                <p>
                  <strong>N.º:</strong>{" "}
                  {numbered ? invoiceNumber(invoice!.estab, invoice!.pto_emi, invoice!.secuencial) : "Se asigna al emitir"}
                </p>
                <p>
                  <strong>Fecha:</strong> {formatDate(form.issue_date)}
                </p>
              </div>
            </div>

            <div className="doc-info">
              <div>
                <h3>Comprador</h3>
                <p>
                  <strong>{form.buyer.name || "Por definir"}</strong>
                </p>
                <p>
                  {identificationTypes.find((t) => t.code === form.buyer.identificationType)?.label}:{" "}
                  {form.buyer.identification || "—"}
                </p>
                {form.buyer.address && <p>{form.buyer.address}</p>}
                <p>{[form.buyer.phone, form.buyer.email].filter(Boolean).join(" · ")}</p>
              </div>
              <div>
                <h3>Pago</h3>
                {form.payments.map((p, i) => (
                  <p key={i}>
                    {paymentMethods.find((m) => m.code === p.method)?.label}: <strong>{formatMoney(p.amount)}</strong>
                    {p.term ? ` · ${p.term} ${p.timeUnit}` : ""}
                  </p>
                ))}
              </div>
            </div>

            <div className="doc-table-wrap">
              {editable && <ProductPicker products={products} onPick={addProduct} />}
              <table className="doc-table invoice-items">
                <thead>
                  <tr>
                    <th style={{ width: 72 }}>Código</th>
                    <th>Descripción</th>
                    <th className="center" style={{ width: 58 }}>
                      Cant.
                    </th>
                    <th className="num" style={{ width: 84 }}>
                      P. unit.
                    </th>
                    <th className="num" style={{ width: 66 }}>
                      Desc.
                    </th>
                    <th style={{ width: 92 }}>IVA</th>
                    <th className="num" style={{ width: 100 }}>
                      Total
                    </th>
                    {editable && <th className="no-print" style={{ width: 38 }} aria-label="Acciones" />}
                  </tr>
                </thead>
                <tbody>
                  {totals.lines.map((line, i) => (
                    <tr key={i}>
                      <td>
                        <input value={line.code} disabled={ro} placeholder={`ITEM${i + 1}`} aria-label="Código" onChange={(e) => setItem(i, { code: e.target.value })} />
                      </td>
                      <td>
                        <input
                          value={line.description}
                          disabled={ro}
                          placeholder="Descripción"
                          aria-label="Descripción"
                          onChange={(e) => setItem(i, { description: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          className="num"
                          type="number"
                          min={0}
                          step="any"
                          disabled={ro}
                          value={line.quantity}
                          aria-label="Cantidad"
                          onChange={(e) => setItem(i, { quantity: Number(e.target.value) })}
                        />
                      </td>
                      <td>
                        <input
                          className="num"
                          type="number"
                          min={0}
                          step="0.01"
                          disabled={ro}
                          value={line.unitPrice}
                          aria-label="Precio unitario"
                          onChange={(e) => setItem(i, { unitPrice: Number(e.target.value) })}
                        />
                      </td>
                      <td>
                        <input
                          className="num"
                          type="number"
                          min={0}
                          step="0.01"
                          disabled={ro}
                          value={line.discount}
                          aria-label="Descuento"
                          onChange={(e) => setItem(i, { discount: Number(e.target.value) })}
                        />
                      </td>
                      <td>
                        <select value={line.vatCode} disabled={ro} aria-label="IVA" onChange={(e) => setItem(i, { vatCode: e.target.value })}>
                          {vatRates.map((v) => (
                            <option key={v.code} value={v.code}>
                              {v.short}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="num">
                        <strong>{formatMoney(line.base)}</strong>
                      </td>
                      {editable && (
                        <td className="center no-print">
                          <button
                            className="remove"
                            aria-label="Quitar ítem"
                            onClick={() =>
                              update({ items: form.items.length === 1 ? [emptyItem()] : form.items.filter((_, idx) => idx !== i) })
                            }
                          >
                            ×
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {editable && (
                <button
                  className="btn-secondary no-print"
                  style={{ marginTop: 12 }}
                  onClick={() => update({ items: [...form.items, emptyItem()] })}
                >
                  + Agregar ítem
                </button>
              )}
            </div>

            <div className="doc-summary">
              {totals.groups.map((g) => (
                <div className="doc-sum-row" key={g.vatCode}>
                  <span>Subtotal {vatLabel(g.vatCode)}</span>
                  <strong>{formatMoney(g.base)}</strong>
                </div>
              ))}
              <div className="doc-sum-row">
                <span>Subtotal sin impuestos</span>
                <strong>{formatMoney(totals.subtotal)}</strong>
              </div>
              <div className="doc-sum-row">
                <span>Descuentos</span>
                <strong>{formatMoney(totals.discount)}</strong>
              </div>
              {totals.groups
                .filter((g) => g.rate > 0)
                .map((g) => (
                  <div className="doc-sum-row" key={`iva-${g.vatCode}`}>
                    <span>{vatLabel(g.vatCode)}</span>
                    <strong>{formatMoney(g.vat)}</strong>
                  </div>
                ))}
              <div className="doc-sum-row total">
                <span>TOTAL</span>
                <strong>{formatMoney(totals.total)}</strong>
              </div>
            </div>

            {form.additional_info.some((f) => f.name && f.value) && (
              <div className="doc-notes" style={{ gridTemplateColumns: "1fr" }}>
                <div className="doc-box">
                  <h3>Información adicional</h3>
                  <p>
                    {form.additional_info
                      .filter((f) => f.name && f.value)
                      .map((f) => `${f.name}: ${f.value}`)
                      .join("\n")}
                  </p>
                </div>
              </div>
            )}

            <div className="doc-footer">
              <div>Vista previa · el comprobante oficial es el RIDE generado tras la autorización.</div>
              <div>{environments[environment]}</div>
            </div>
          </main>
        </div>
      </div>

      <ConfirmDialog
        open={dialog === "emit"}
        title="Emitir factura al SRI"
        message={
          <>
            Se firmará y enviará la factura por <strong>{formatMoney(totals.total)}</strong> a{" "}
            <strong>{form.buyer.name}</strong> en el ambiente de <strong>{environments[environment].toUpperCase()}</strong>.
            {!numbered && " Se le asignará el siguiente número secuencial."}
            {form.buyer.email.trim() && (
              <>
                {" "}Al quedar autorizada se enviará a <strong>{form.buyer.email.trim()}</strong>.
              </>
            )}
          </>
        }
        confirmLabel="Firmar y emitir"
        onCancel={() => setDialog(null)}
        onConfirm={() => {
          setDialog(null);
          emit();
        }}
      />
      <ConfirmDialog
        open={dialog === "void"}
        title="Marcar como anulada"
        message="Esto solo registra la anulación en el panel. Debes solicitar la anulación del comprobante en el portal del SRI (SRI en línea) y contar con la aceptación del comprador."
        confirmLabel="Marcar anulada"
        tone="danger"
        onCancel={() => setDialog(null)}
        onConfirm={() => {
          setDialog(null);
          voidInvoice();
        }}
      />
      <ConfirmDialog
        open={dialog === "delete"}
        title="Eliminar borrador"
        message="Se eliminará este borrador de factura. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        tone="danger"
        onCancel={() => setDialog(null)}
        onConfirm={() => {
          setDialog(null);
          remove();
        }}
      />
      <ConfirmDialog
        open={dialog === "email"}
        title="Enviar factura por correo"
        message={
          <label className="field" style={{ margin: 0 }}>
            Destinatarios (máximo 3, separados por coma)
            <input value={recipients} onChange={(e) => setRecipients(e.target.value)} maxLength={800} />
          </label>
        }
        confirmLabel="Enviar"
        onCancel={() => setDialog(null)}
        onConfirm={sendEmail}
      />
    </>
  );
}
