import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

const LOGIN_PATH = "/admin/login";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, publishableKey } = getSupabaseEnv();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // getClaims valida el JWT y refresca la sesión cuando es necesario.
  const { data } = await supabase.auth.getClaims();
  let isLoggedIn = Boolean(data?.claims?.sub);
  const isLoginPage = request.nextUrl.pathname === LOGIN_PATH;

  // requireAdmin manda aquí a quien tiene sesión pero no es administrador. Un Server
  // Component no puede borrar cookies, así que se cierra la sesión en el proxy; si no,
  // la sesión seguiría viva y el login lo devolvería a /admin en un bucle infinito.
  if (isLoggedIn && isLoginPage && request.nextUrl.searchParams.has("error")) {
    await supabase.auth.signOut({ scope: "local" });
    isLoggedIn = false;
  }

  if (!isLoggedIn && !isLoginPage) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = LOGIN_PATH;
    loginUrl.search = "";
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && isLoginPage) {
    const panelUrl = request.nextUrl.clone();
    panelUrl.pathname = "/admin";
    panelUrl.search = "";
    return NextResponse.redirect(panelUrl);
  }

  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
