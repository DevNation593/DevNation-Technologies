import Link from "next/link";
import { MobileNav, SidebarNav } from "@/components/admin/AdminNav";
import CertificateBanner from "@/components/admin/CertificateBanner";
import { requireAdmin } from "@/lib/admin/auth";
import { signOut } from "../login/actions";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  return (
    <div className="adm-shell">
      <aside className="adm-sidebar">
        <div className="adm-brand">
          DEVNATION <span>TECH</span>
          <small>PANEL ADMINISTRATIVO</small>
        </div>
        <SidebarNav />
        <div className="adm-user">
          <strong>{admin.fullName || "Administrador"}</strong>
          {admin.email}
          <form action={signOut}>
            <button type="submit" className="btn-sm">
              Cerrar sesión
            </button>
          </form>
          <p style={{ margin: "10px 0 0" }}>
            <Link href="/">Ver sitio público ↗</Link>
          </p>
        </div>
      </aside>
      <div className="adm-main">
        <MobileNav />
        <CertificateBanner />
        {children}
      </div>
    </div>
  );
}
