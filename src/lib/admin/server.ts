import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { inferIdentificationType } from "@/lib/sri/identification";
import type { IdentificationType } from "@/lib/sri/catalogs";
import type { ClientSnapshot, CompanySettings } from "./types";

export type ActionResult<T = { id: string }> = ({ ok: true } & T) | { ok: false; error: string };

export function actionError(error: unknown): { ok: false; error: string } {
  if (error && typeof error === "object" && "message" in error) {
    return { ok: false, error: String((error as { message: unknown }).message) };
  }
  return { ok: false, error: "Ocurrió un error inesperado." };
}

export function text(value: unknown, max = 2000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function number(value: unknown, min = 0, max = 1_000_000_000): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export async function getCompanySettings(supabase: SupabaseClient): Promise<CompanySettings> {
  const { data, error } = await supabase.from("company_settings").select("*").eq("id", 1).single();
  if (error) throw error;
  return { ...data, ambiente: Number(data.ambiente) as 1 | 2 } as CompanySettings;
}

export async function nextNumber(supabase: SupabaseClient, key: string): Promise<number> {
  const { data, error } = await supabase.rpc("next_document_number", { p_key: key });
  if (error) throw error;
  return Number(data);
}

/**
 * Registra o actualiza el cliente a partir de los datos escritos en un
 * documento. Devuelve su id, o null si el documento no tiene identificación.
 */
export async function upsertClient(
  supabase: SupabaseClient,
  snapshot: ClientSnapshot,
  identificationType?: IdentificationType,
): Promise<string | null> {
  const identification = snapshot.identification.trim();
  const name = snapshot.name.trim();
  if (!identification || !name) return null;

  const { data, error } = await supabase
    .from("clients")
    .upsert(
      {
        identification_type: identificationType ?? inferIdentificationType(identification),
        identification,
        name,
        email: snapshot.email.trim(),
        phone: snapshot.phone.trim(),
        address: snapshot.address.trim(),
        ...(snapshot.legalRepresentative ? { legal_representative: snapshot.legalRepresentative.trim() } : {}),
      },
      { onConflict: "identification_type,identification" },
    )
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}
