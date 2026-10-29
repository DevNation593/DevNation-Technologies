import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface AdminSession {
  userId: string;
  email: string;
  fullName: string;
}

/**
 * Verifica que haya sesión y que el usuario esté registrado como administrador.
 * El proxy ya bloquea a los visitantes sin sesión; esto cubre usuarios
 * autenticados que no fueron dados de alta con el comando de administración.
 */
export const requireAdmin = cache(async (): Promise<AdminSession> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims?.sub) redirect("/admin/login");

  const { data: admin, error } = await supabase
    .from("admin_users")
    .select("full_name")
    .eq("user_id", claims.sub)
    .maybeSingle();

  // Un fallo de la consulta no significa que el usuario no sea administrador:
  // se muestra el error en lugar de cerrarle la sesión.
  if (error) throw new Error("No se pudo verificar el acceso al panel.");

  if (!admin) {
    await supabase.auth.signOut();
    redirect("/admin/login?error=no-autorizado");
  }

  return {
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : "",
    fullName: admin.full_name ?? "",
  };
});

/** Para server actions: igual que requireAdmin pero devuelve el cliente listo para usar. */
export async function adminClient() {
  await requireAdmin();
  return createClient();
}
