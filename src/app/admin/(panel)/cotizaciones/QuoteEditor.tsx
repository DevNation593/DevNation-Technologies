"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ClientPicker from "@/components/admin/ClientPicker";
import CompanyLogo from "@/components/admin/CompanyLogo";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import PageHeader from "@/components/admin/PageHeader";
import { addDays, formatDate, formatMoney, formatPercent, todayInEcuador } from "@/lib/admin/format";
import { DEFAULT_QUOTE_NOTES, computeQuoteTotals } from "@/lib/admin/quote";
import type { Client, ClientSnapshot, CompanySettings, Quote, QuoteItem, QuoteStatus } from "@/lib/admin/types";
import { toNumber } from "@/lib/admin/types";
import {
  createContractFromQuote,
  createInvoiceFromQuote,
  deleteQuote,
  saveQuote,
  type QuoteInput,
} from "./actions";

const statusOptions: { value: QuoteStatus; label: string }[] = [
  { value: "borrador", label: "Borrador" },
  { value: "enviada", label: "Enviada al cliente" },
  { value: "aceptada", label: "Aceptada" },
  { value: "rechazada", label: "Rechazada" },
  { value: "facturada", label: "Facturada" },
];

const emptyClient: ClientSnapshot = { name: "", identification: "", email: "", phone: "", address: "" };

function initialState(quote: Quote | null): QuoteInput {
  if (!quote) {
    return {
      status: "borrador",
      issue_date: todayInEcuador(),
      valid_days: 15,
      currency: "USD",
      client: emptyClient,
      items: [
        { description: "Desarrollo / servicio tecnológico", qty: 1, price: 0 },
        { description: "Soporte o implementación", qty: 1, price: 0 },
      ],
      tax_rate: 15,
      discount_rate: 0,
      payment_terms: "50% anticipo / 50% contra entrega",
      delivery_time: "Por coordinar según alcance",
      notes: DEFAULT_QUOTE_NOTES,
    };
  }
  return {
    status: quote.status,
    issue_date: quote.issue_date,
    valid_days: quote.valid_days,
    currency: quote.currency,
    client: { ...emptyClient, ...quote.client },
    items: quote.items.length ? quote.items : [{ description: "", qty: 1, price: 0 }],
    tax_rate: toNumber(quote.tax_rate),
    discount_rate: toNumber(quote.discount_rate),
    payment_terms: quote.payment_terms,
    delivery_time: quote.delivery_time,
    notes: quote.notes,
  };
}

export default function QuoteEditor({
  quote,
  settings,
  clients,
}: {
  quote: Quote | null;
  settings: CompanySettings;
  clients: Client[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<QuoteInput>(() => initialState(quote));
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof QuoteInput>(key: K, value: QuoteInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const setClient = (key: keyof ClientSnapshot, value: string) =>
    setForm((f) => ({ ...f, client: { ...f.client, [key]: value } }));
  const setItem = (index: number, patch: Partial<QuoteItem>) =>
    setForm((f) => ({ ...f, items: f.items.map((it, i) => (i === index ? { ...it, ...patch } : it)) }));
  const removeItem = (index: number) =>
    setForm((f) => ({
      ...f,
      items: f.items.length === 1 ? [{ description: "", qty: 1, price: 0 }] : f.items.filter((_, i) => i !== index),
    }));

  const totals = computeQuoteTotals(form.items, form.discount_rate, form.tax_rate);
  const money = (v: number) => formatMoney(v, form.currency);

  function run(task: () => Promise<{ ok: boolean; error?: string; id?: string }>, onOk: (id?: string) => void) {
    setMessage(null);
    startTransition(async () => {
      const result = await task();
      if (!result.ok) setMessage({ text: result.error ?? "Error", error: true });
      else onOk(result.id);
    });
  }

  const save = () =>
    run(
      () => saveQuote(quote?.id ?? null, form),
      (id) => {
        setMessage({ text: "Cotización guardada." });
        if (!quote && id) router.replace(`/admin/cotizaciones/${id}`);
        else router.refresh();
      },
    );

  const companyLine = [
    settings.ruc && `RUC: ${settings.ruc}`,
    settings.dir_matriz,
    settings.telefono,
    settings.email,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <PageHeader
        title={quote ? `Proforma ${quote.number}` : "Nueva proforma"}
        crumbs={[{ href: "/admin/cotizaciones", label: "Cotizaciones" }]}
      >
        {quote && (
          <>
            <button
              className="btn-secondary"
              disabled={pending}
              onClick={() => run(() => createContractFromQuote(quote.id), (id) => router.push(`/admin/contratos/${id}`))}
            >
              Crear contrato
            </button>
            <button
              className="btn-secondary"
              disabled={pending}
              onClick={() => run(() => createInvoiceFromQuote(quote.id), (id) => router.push(`/admin/facturas/${id}`))}
            >
              Facturar
            </button>
          </>
        )}
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
            <h2>Editor de cotizaciones</h2>
            <p className="intro">Prepara propuestas comerciales profesionales.</p>

            {message && <p className={message.error ? "notice danger" : "notice success"}>{message.text}</p>}

            <label className="field">
              Estado
              <select value={form.status} onChange={(e) => set("status", e.target.value as QuoteStatus)}>
                {statusOptions.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="section-title">Proforma</div>
            <div className="grid2">
              <label className="field">
                Fecha
                <input type="date" value={form.issue_date} onChange={(e) => set("issue_date", e.target.value)} />
              </label>
              <label className="field">
                Validez (días)
                <input
                  type="number"
                  min={1}
                  value={form.valid_days}
                  onChange={(e) => set("valid_days", Number(e.target.value))}
                />
              </label>
            </div>
            <label className="field">
              Moneda
              <select value={form.currency} onChange={(e) => set("currency", e.target.value as "USD" | "EUR")}>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </label>

            <div className="section-title">Cliente</div>
            <ClientPicker
              clients={clients}
              onPick={(c) =>
                set("client", {
                  name: c.name,
                  identification: c.identification,
                  email: c.email,
                  phone: c.phone,
                  address: c.address,
                })
              }
            />
            <label className="field">
              Cliente / Empresa
              <input value={form.client.name} onChange={(e) => setClient("name", e.target.value)} />
            </label>
            <label className="field">
              RUC / Cédula
              <input value={form.client.identification} onChange={(e) => setClient("identification", e.target.value)} />
            </label>
            <div className="grid2">
              <label className="field">
                Teléfono
                <input value={form.client.phone} onChange={(e) => setClient("phone", e.target.value)} />
              </label>
              <label className="field">
                Email
                <input value={form.client.email} onChange={(e) => setClient("email", e.target.value)} />
              </label>
            </div>
            <label className="field">
              Dirección
              <input value={form.client.address} onChange={(e) => setClient("address", e.target.value)} />
            </label>

            <div className="section-title">Impuestos y descuentos</div>
            <div className="grid2">
              <label className="field">
                IVA (%)
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.tax_rate}
                  onChange={(e) => set("tax_rate", Number(e.target.value))}
                />
              </label>
              <label className="field">
                Descuento (%)
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={form.discount_rate}
                  onChange={(e) => set("discount_rate", Number(e.target.value))}
                />
              </label>
            </div>

            <div className="section-title">Condiciones</div>
            <label className="field">
              Forma de pago
              <input value={form.payment_terms} onChange={(e) => set("payment_terms", e.target.value)} />
            </label>
            <label className="field">
              Tiempo de entrega
              <input value={form.delivery_time} onChange={(e) => set("delivery_time", e.target.value)} />
            </label>
            <label className="field">
              Observaciones
              <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </label>

            {quote && (
              <>
                <div className="section-title">Zona de riesgo</div>
                <button className="btn-danger" disabled={pending} onClick={() => setConfirmDelete(true)}>
                  Eliminar cotización
                </button>
              </>
            )}
          </aside>

          <main className="doc-sheet">
            <div className="doc-head">
              <div className="doc-company">
                <CompanyLogo src={settings.logo_data_url} />
                <div>
                  <h1>{settings.nombre_comercial || settings.razon_social}</h1>
                  <p>{companyLine || "Quito, Ecuador"}</p>
                </div>
              </div>
              <div className="doc-title">
                <h2>PROFORMA</h2>
                <p className="kicker">Propuesta comercial</p>
                <p>
                  <strong>N.º:</strong> {quote?.number ?? "Se asigna al guardar"}
                </p>
                <p>
                  <strong>Fecha:</strong> {formatDate(form.issue_date)}
                </p>
                <p>
                  <strong>Válida hasta:</strong> {addDays(form.issue_date, form.valid_days)}
                </p>
              </div>
            </div>

            <div className="doc-info">
              <div>
                <h3>Datos del cliente</h3>
                <p>
                  <strong>{form.client.name || "Cliente por definir"}</strong>
                </p>
                {form.client.identification && <p>RUC / Cédula: {form.client.identification}</p>}
                <p>{[form.client.phone, form.client.email].filter(Boolean).join(" · ")}</p>
                {form.client.address && <p>{form.client.address}</p>}
              </div>
              <div>
                <h3>Información comercial</h3>
                <p>
                  <strong>Moneda:</strong> {form.currency}
                </p>
                <p>
                  <strong>Forma de pago:</strong> {form.payment_terms || "Por definir"}
                </p>
                <p>
                  <strong>Entrega:</strong> {form.delivery_time || "Por definir"}
                </p>
              </div>
            </div>

            <div className="doc-table-wrap">
              <table className="doc-table">
                <thead>
                  <tr>
                    <th style={{ width: "46%" }}>Descripción</th>
                    <th className="center" style={{ width: "12%" }}>
                      Cant.
                    </th>
                    <th className="num" style={{ width: "18%" }}>
                      Precio unit.
                    </th>
                    <th className="num" style={{ width: "18%" }}>
                      Total
                    </th>
                    <th className="center no-print" style={{ width: "6%" }} aria-label="Acciones" />
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((it, i) => (
                    <tr key={i}>
                      <td>
                        <input
                          value={it.description}
                          placeholder="Descripción del producto o servicio"
                          aria-label="Descripción"
                          onChange={(e) => setItem(i, { description: e.target.value })}
                        />
                      </td>
                      <td className="center">
                        <input
                          type="number"
                          min={0}
                          step="1"
                          value={it.qty}
                          aria-label="Cantidad"
                          onChange={(e) => setItem(i, { qty: Math.max(0, Number(e.target.value)) })}
                        />
                      </td>
                      <td className="num">
                        <input
                          className="num"
                          type="number"
                          min={0}
                          step="0.01"
                          value={it.price}
                          aria-label="Precio unitario"
                          onChange={(e) => setItem(i, { price: Math.max(0, Number(e.target.value)) })}
                        />
                      </td>
                      <td className="num">
                        <strong>{money(it.qty * it.price)}</strong>
                      </td>
                      <td className="center no-print">
                        <button className="remove" aria-label="Quitar fila" onClick={() => removeItem(i)}>
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                className="btn-secondary no-print"
                style={{ marginTop: 12 }}
                onClick={() => set("items", [...form.items, { description: "", qty: 1, price: 0 }])}
              >
                + Agregar producto o servicio
              </button>
            </div>

            <div className="doc-summary">
              <div className="doc-sum-row">
                <span>Subtotal</span>
                <strong>{money(totals.subtotal)}</strong>
              </div>
              <div className="doc-sum-row">
                <span>Descuento ({formatPercent(form.discount_rate)})</span>
                <strong>- {money(totals.discount)}</strong>
              </div>
              <div className="doc-sum-row">
                <span>Base imponible</span>
                <strong>{money(totals.taxable)}</strong>
              </div>
              <div className="doc-sum-row">
                <span>IVA ({formatPercent(form.tax_rate)})</span>
                <strong>{money(totals.tax)}</strong>
              </div>
              <div className="doc-sum-row total">
                <span>TOTAL</span>
                <strong>{money(totals.total)}</strong>
              </div>
            </div>

            <div className="doc-notes">
              <div className="doc-box">
                <h3>Condiciones comerciales</h3>
                <p>
                  {`Forma de pago: ${form.payment_terms || "Por definir"}\nTiempo de entrega: ${form.delivery_time || "Por definir"}\nValidez de la oferta: ${form.valid_days || 0} días.`}
                </p>
              </div>
              <div className="doc-box">
                <h3>Observaciones</h3>
                <p>{form.notes || "Sin observaciones."}</p>
              </div>
            </div>

            <div className="doc-footer">
              <div>
                <strong style={{ color: "#143651" }}>{(settings.nombre_comercial || settings.razon_social).toUpperCase()}</strong>{" "}
                · Soluciones tecnológicas
              </div>
              <div>Documento comercial informativo · No constituye factura.</div>
            </div>
          </main>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Eliminar cotización"
        message={`Se eliminará la proforma ${quote?.number}. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        tone="danger"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          if (quote) run(() => deleteQuote(quote.id), () => router.push("/admin/cotizaciones"));
        }}
      />
    </>
  );
}
