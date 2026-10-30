import "server-only";
import { createClient } from "@/lib/supabase/server";
import { toNumber, type Client, type Product } from "./types";

export async function listClients(): Promise<Client[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").select("*").order("name").limit(1000);
  if (error) throw error;
  return data as Client[];
}

export async function listProducts(): Promise<Product[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, code, description, unit_price, vat_code")
    .order("description")
    .limit(1000);
  if (error) throw error;
  return data.map((p) => ({ ...p, unit_price: toNumber(p.unit_price) }));
}

/**
 * Patrón ILIKE para el filtro `or` de PostgREST. Quita los comodines y los
 * caracteres reservados de la sintaxis del filtro en lugar de escaparlos.
 */
export function searchPattern(q: string): string {
  const term = q.replace(/[%_\\"(),.:*]/g, " ").trim().slice(0, 100);
  return `"%${term}%"`;
}
