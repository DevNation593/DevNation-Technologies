"use client";

import { useId, useState } from "react";
import Link from "next/link";
import type { Product } from "@/lib/admin/types";

/** Buscador del catálogo de productos: al elegir uno, lo agrega como ítem del documento. */
export default function ProductPicker({ products, onPick }: { products: Product[]; onPick: (product: Product) => void }) {
  const listId = useId();
  const [value, setValue] = useState("");

  if (!products.length) {
    return (
      <p className="hint no-print">
        ¿Facturas siempre lo mismo? <Link href="/admin/productos">Crea tus productos</Link> para agregarlos con un clic.
      </p>
    );
  }

  const optionLabel = (p: Product) => `${p.description} · ${p.code}`;

  return (
    <label className="field no-print">
      Agregar producto registrado
      <input
        list={listId}
        value={value}
        placeholder="Escribe descripción o código"
        onChange={(e) => {
          const next = e.target.value;
          const match = products.find((p) => optionLabel(p) === next);
          if (match) {
            onPick(match);
            setValue("");
          } else {
            setValue(next);
          }
        }}
      />
      <datalist id={listId}>
        {products.map((p) => (
          <option key={p.id} value={optionLabel(p)} />
        ))}
      </datalist>
    </label>
  );
}
