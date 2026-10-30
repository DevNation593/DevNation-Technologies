"use server";

import { revalidatePath } from "next/cache";
import { adminClient } from "@/lib/admin/auth";
import { actionError, number, text, type ActionResult } from "@/lib/admin/server";
import type { Product } from "@/lib/admin/types";
import { vatRates } from "@/lib/sri/catalogs";

export type ProductInput = Omit<Product, "id">;

export async function saveProduct(id: string | null, input: ProductInput): Promise<ActionResult> {
  try {
    const supabase = await adminClient();
    const row = {
      code: text(input.code, 25),
      description: text(input.description, 300),
      unit_price: Math.round(number(input.unit_price, 0, 100_000_000) * 1_000_000) / 1_000_000,
      vat_code: vatRates.some((v) => v.code === input.vat_code) ? input.vat_code : "4",
    };
    if (!row.code) throw new Error("Indica el código del producto.");
    if (!row.description) throw new Error("Indica la descripción del producto.");

    const query = id
      ? supabase.from("products").update(row).eq("id", id).select("id").single()
      : supabase.from("products").insert(row).select("id").single();
    const { data, error } = await query;
    if (error) {
      if (error.code === "23505") throw new Error("Ya existe un producto con ese código.");
      throw error;
    }
    revalidatePath("/admin/productos");
    return { ok: true, id: data.id };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteProduct(id: string): Promise<ActionResult<object>> {
  try {
    const supabase = await adminClient();
    // Las facturas guardan una copia de los datos del producto en sus ítems.
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/admin/productos");
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}
