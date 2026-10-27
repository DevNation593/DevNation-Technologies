"use server";

import { revalidatePath } from "next/cache";
import { adminClient } from "@/lib/admin/auth";
import { actionError, text, type ActionResult } from "@/lib/admin/server";
import type { Client } from "@/lib/admin/types";
import { identificationTypes } from "@/lib/sri/catalogs";
import { validateIdentification } from "@/lib/sri/identification";

export type ClientInput = Omit<Client, "id">;

export async function saveClient(id: string | null, input: ClientInput): Promise<ActionResult> {
  try {
    const supabase = await adminClient();
    const type = identificationTypes.some((t) => t.code === input.identification_type)
      ? input.identification_type
      : "05";
    const row = {
      identification_type: type,
      identification: text(input.identification, 20),
      name: text(input.name, 300),
      email: text(input.email, 200),
      phone: text(input.phone, 50),
      address: text(input.address, 300),
      legal_representative: text(input.legal_representative, 200),
    };
    const idError = validateIdentification(type, row.identification);
    if (idError) throw new Error(idError);
    if (!row.name) throw new Error("Indica el nombre o razón social.");

    const query = id
      ? supabase.from("clients").update(row).eq("id", id).select("id").single()
      : supabase.from("clients").insert(row).select("id").single();
    const { data, error } = await query;
    if (error) {
      if (error.code === "23505") throw new Error("Ya existe un cliente con esa identificación.");
      throw error;
    }
    revalidatePath("/admin/clientes");
    return { ok: true, id: data.id };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteClient(id: string): Promise<ActionResult<object>> {
  try {
    const supabase = await adminClient();
    // Los documentos conservan una copia de los datos del cliente; solo pierden el vínculo.
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/admin/clientes");
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}
