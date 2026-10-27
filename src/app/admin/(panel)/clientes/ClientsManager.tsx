"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import type { Client } from "@/lib/admin/types";
import { identificationTypes, type IdentificationType } from "@/lib/sri/catalogs";
import { deleteClient, saveClient, type ClientInput } from "./actions";

const emptyClient: ClientInput = {
  identification_type: "04",
  identification: "",
  name: "",
  email: "",
  phone: "",
  address: "",
  legal_representative: "",
};

export default function ClientsManager({ clients }: { clients: Client[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<{ id: string | null; data: ClientInput } | null>(null);
  const [toDelete, setToDelete] = useState<Client | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (patch: Partial<ClientInput>) =>
    setEditing((e) => (e ? { ...e, data: { ...e.data, ...patch } } : e));

  const save = () =>
    startTransition(async () => {
      if (!editing) return;
      const result = await saveClient(editing.id, editing.data);
      if (!result.ok) return setMessage({ text: result.error, error: true });
      setMessage({ text: "Cliente guardado." });
      setEditing(null);
      router.refresh();
    });

  const remove = (client: Client) =>
    startTransition(async () => {
      const result = await deleteClient(client.id);
      setMessage(result.ok ? { text: "Cliente eliminado." } : { text: result.error, error: true });
      router.refresh();
    });

  return (
    <div className="adm-workspace" style={{ gridTemplateColumns: editing ? "minmax(0,1fr) 360px" : "1fr" }}>
      <div>
        <div className="adm-filters">
          <button className="btn-primary" onClick={() => setEditing({ id: null, data: emptyClient })}>
            + Nuevo cliente
          </button>
        </div>
        {message && <p className={message.error ? "notice danger" : "notice success"}>{message.text}</p>}
        <div className="adm-card adm-table-wrap">
          {clients.length ? (
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Identificación</th>
                  <th>Contacto</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.name}</strong>
                      {c.legal_representative && <div className="hint">Rep.: {c.legal_representative}</div>}
                    </td>
                    <td>
                      {c.identification}
                      <div className="hint">{identificationTypes.find((t) => t.code === c.identification_type)?.label}</div>
                    </td>
                    <td>
                      {c.email}
                      <div className="hint">{c.phone}</div>
                    </td>
                    <td className="num">
                      <button
                        className="btn-ghost btn-sm"
                        onClick={() => {
                          const { id, ...data } = c;
                          setEditing({ id, data });
                        }}
                      >
                        Editar
                      </button>
                      <button className="btn-ghost btn-sm" onClick={() => setToDelete(c)}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="adm-empty">
              Aún no hay clientes. Se registran automáticamente al guardar cotizaciones, contratos o facturas.
            </p>
          )}
        </div>
      </div>

      {editing && (
        <aside className="adm-card adm-editor">
          <h2>{editing.id ? "Editar cliente" : "Nuevo cliente"}</h2>
          <p className="intro">Los documentos ya emitidos conservan los datos con los que se crearon.</p>
          <label className="field">
            Tipo de identificación
            <select
              value={editing.data.identification_type}
              onChange={(e) => set({ identification_type: e.target.value as IdentificationType })}
            >
              {identificationTypes
                .filter((t) => t.code !== "07")
                .map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.label}
                  </option>
                ))}
            </select>
          </label>
          <label className="field">
            Identificación
            <input value={editing.data.identification} onChange={(e) => set({ identification: e.target.value })} />
          </label>
          <label className="field">
            Nombre o razón social
            <input value={editing.data.name} onChange={(e) => set({ name: e.target.value })} />
          </label>
          <label className="field">
            Representante legal
            <input
              value={editing.data.legal_representative}
              onChange={(e) => set({ legal_representative: e.target.value })}
            />
          </label>
          <div className="grid2">
            <label className="field">
              Email
              <input type="email" value={editing.data.email} onChange={(e) => set({ email: e.target.value })} />
            </label>
            <label className="field">
              Teléfono
              <input value={editing.data.phone} onChange={(e) => set({ phone: e.target.value })} />
            </label>
          </div>
          <label className="field">
            Dirección
            <input value={editing.data.address} onChange={(e) => set({ address: e.target.value })} />
          </label>
          <div className="adm-actions">
            <button className="btn-primary" onClick={save} disabled={pending}>
              Guardar
            </button>
            <button className="btn-secondary" onClick={() => setEditing(null)}>
              Cancelar
            </button>
          </div>
        </aside>
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Eliminar cliente"
        message={`Se eliminará ${toDelete?.name}. Sus cotizaciones, contratos y facturas se conservan.`}
        confirmLabel="Eliminar"
        tone="danger"
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) remove(toDelete);
          setToDelete(null);
        }}
      />
    </div>
  );
}
