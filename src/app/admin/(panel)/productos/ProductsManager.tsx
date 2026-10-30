"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { formatMoney } from "@/lib/admin/format";
import type { Product } from "@/lib/admin/types";
import { vatLabel, vatRates } from "@/lib/sri/catalogs";
import { deleteProduct, saveProduct, type ProductInput } from "./actions";

const emptyProduct: ProductInput = { code: "", description: "", unit_price: 0, vat_code: "4" };

export default function ProductsManager({ products }: { products: Product[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<{ id: string | null; data: ProductInput } | null>(null);
  const [toDelete, setToDelete] = useState<Product | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (patch: Partial<ProductInput>) =>
    setEditing((e) => (e ? { ...e, data: { ...e.data, ...patch } } : e));

  const save = () =>
    startTransition(async () => {
      if (!editing) return;
      const result = await saveProduct(editing.id, editing.data);
      if (!result.ok) return setMessage({ text: result.error, error: true });
      setMessage({ text: "Producto guardado." });
      setEditing(null);
      router.refresh();
    });

  const remove = (product: Product) =>
    startTransition(async () => {
      const result = await deleteProduct(product.id);
      setMessage(result.ok ? { text: "Producto eliminado." } : { text: result.error, error: true });
      router.refresh();
    });

  return (
    <div className="adm-workspace" style={{ gridTemplateColumns: editing ? "minmax(0,1fr) 360px" : "1fr" }}>
      <div>
        <div className="adm-filters">
          <button className="btn-primary" onClick={() => setEditing({ id: null, data: emptyProduct })}>
            + Nuevo producto
          </button>
        </div>
        {message && <p className={message.error ? "notice danger" : "notice success"}>{message.text}</p>}
        <div className="adm-card adm-table-wrap">
          {products.length ? (
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Código</th>
                  <th>IVA</th>
                  <th className="num">Precio unitario</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.description}</strong>
                    </td>
                    <td>{p.code}</td>
                    <td>{vatLabel(p.vat_code)}</td>
                    <td className="num">{formatMoney(p.unit_price)}</td>
                    <td className="num">
                      <button
                        className="btn-ghost btn-sm"
                        onClick={() => {
                          const { id, ...data } = p;
                          setEditing({ id, data });
                        }}
                      >
                        Editar
                      </button>
                      <button className="btn-ghost btn-sm" onClick={() => setToDelete(p)}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="adm-empty">
              Aún no hay productos. Créalos aquí para agregarlos rápidamente como ítems de tus facturas.
            </p>
          )}
        </div>
      </div>

      {editing && (
        <aside className="adm-card adm-editor">
          <h2>{editing.id ? "Editar producto" : "Nuevo producto"}</h2>
          <p className="intro">Las facturas ya creadas conservan los datos con los que se agregó el producto.</p>
          <label className="field">
            Código
            <input
              value={editing.data.code}
              maxLength={25}
              placeholder="p. ej. DEV-WEB"
              onChange={(e) => set({ code: e.target.value })}
            />
          </label>
          <label className="field">
            Descripción
            <input
              value={editing.data.description}
              maxLength={300}
              onChange={(e) => set({ description: e.target.value })}
            />
          </label>
          <div className="grid2">
            <label className="field">
              Precio unitario (sin IVA)
              <input
                className="num"
                type="number"
                min={0}
                step="any"
                value={editing.data.unit_price}
                onChange={(e) => set({ unit_price: Number(e.target.value) })}
              />
            </label>
            <label className="field">
              IVA
              <select value={editing.data.vat_code} onChange={(e) => set({ vat_code: e.target.value })}>
                {vatRates.map((v) => (
                  <option key={v.code} value={v.code}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
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
        title="Eliminar producto"
        message={`Se eliminará ${toDelete?.description}. Las facturas que ya lo incluyen se conservan.`}
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
