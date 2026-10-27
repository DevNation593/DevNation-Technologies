import type { Metadata } from "next";
import Link from "next/link";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <main className="adm-login">
      <div className="adm-card">
        <div className="brand">
          <span>DEVNATION</span> TECHNOLOGIES
        </div>
        <h1>Panel administrativo</h1>
        <p className="hint" style={{ margin: "0 0 20px" }}>
          Facturación, cotizaciones y contratos.
        </p>
        <LoginForm
          next={next ?? "/admin"}
          initialError={error === "no-autorizado" ? "Tu usuario no tiene acceso al panel." : null}
        />
        <p className="hint" style={{ marginTop: 18, textAlign: "center" }}>
          <Link href="/">← Volver al sitio</Link>
        </p>
      </div>
    </main>
  );
}
