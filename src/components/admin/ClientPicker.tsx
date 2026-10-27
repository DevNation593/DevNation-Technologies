"use client";

import { useId, useState } from "react";
import type { Client } from "@/lib/admin/types";

/** Buscador de clientes registrados: al elegir uno, rellena los campos del documento. */
export default function ClientPicker({ clients, onPick }: { clients: Client[]; onPick: (client: Client) => void }) {
  const listId = useId();
  const [value, setValue] = useState("");

  if (!clients.length) return null;

  const optionLabel = (c: Client) => `${c.name} · ${c.identification}`;

  return (
    <label className="field">
      Buscar cliente registrado
      <input
        list={listId}
        value={value}
        placeholder="Escribe nombre o identificación"
        onChange={(e) => {
          const next = e.target.value;
          const match = clients.find((c) => optionLabel(c) === next);
          if (match) {
            onPick(match);
            setValue("");
          } else {
            setValue(next);
          }
        }}
      />
      <datalist id={listId}>
        {clients.map((c) => (
          <option key={c.id} value={optionLabel(c)} />
        ))}
      </datalist>
    </label>
  );
}
