import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Aviso que queda en la factura mientras el envío automático está en curso. Si el proceso
 * se corta antes de confirmar o liberar, la factura no aparece como enviada sin más: el
 * aviso sigue visible e indica que hay que reenviarla.
 */
export const AUTO_SEND_PENDING = "el envío automático no terminó; reenvía la factura si el comprador no la recibió.";

/**
 * Reserva el envío automático: marca last_emailed_at solo si estaba vacío, para que dos
 * peticiones simultáneas no envíen el mismo correo. Devuelve la marca de la reserva o null
 * si otra petición ya la tenía.
 */
export async function claimAutoSend(supabase: SupabaseClient, invoiceId: string, to: string[]): Promise<string | null> {
  const claimedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("invoices")
    .update({ last_emailed_at: claimedAt, last_emailed_to: to.join(", "), last_email_error: AUTO_SEND_PENDING })
    .eq("id", invoiceId)
    .is("last_emailed_at", null)
    .select("id");
  if (error) throw new Error("No se pudo registrar el envío del correo.");
  return data?.length ? claimedAt : null;
}

/**
 * Confirma el envío de la reserva `claimedAt`. Solo actúa si la factura sigue con esa marca,
 * para no tocar el registro de un reenvío manual que terminó mientras tanto.
 */
export async function confirmAutoSend(supabase: SupabaseClient, invoiceId: string, claimedAt: string): Promise<void> {
  await supabase
    .from("invoices")
    .update({ last_email_error: null })
    .eq("id", invoiceId)
    .eq("last_emailed_at", claimedAt);
}

/** Libera la reserva `claimedAt` tras un fallo y deja el error visible en la factura. */
export async function releaseAutoSend(
  supabase: SupabaseClient,
  invoiceId: string,
  claimedAt: string,
  message: string,
): Promise<void> {
  const { error } = await supabase
    .from("invoices")
    .update({ last_emailed_at: null, last_emailed_to: null, last_email_error: message })
    .eq("id", invoiceId)
    .eq("last_emailed_at", claimedAt);
  // Si no se pudo liberar, el aviso AUTO_SEND_PENDING sigue visible en la factura.
  if (error) console.error("No se pudo liberar la reserva del envío automático de la factura", invoiceId);
}
