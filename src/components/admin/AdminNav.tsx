"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@iconify/react";

export const adminSections = [
  { href: "/admin", label: "Inicio", icon: "tabler:layout-dashboard" },
  { href: "/admin/facturas", label: "Facturación", icon: "tabler:file-invoice" },
  { href: "/admin/cotizaciones", label: "Cotizaciones", icon: "tabler:file-dollar" },
  { href: "/admin/contratos", label: "Contratos", icon: "tabler:file-certificate" },
  { href: "/admin/clientes", label: "Clientes", icon: "tabler:users" },
  { href: "/admin/productos", label: "Productos", icon: "tabler:package" },
  { href: "/admin/configuracion", label: "Configuración", icon: "tabler:settings" },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === href : pathname.startsWith(href);
}

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav className="adm-nav" aria-label="Panel administrativo">
      {adminSections.map((s) => (
        <Link key={s.href} href={s.href} className={isActive(pathname, s.href) ? "active" : undefined}>
          <Icon icon={s.icon} aria-hidden="true" />
          {s.label}
        </Link>
      ))}
    </nav>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="adm-mobile-nav" aria-label="Panel administrativo">
      {adminSections.map((s) => (
        <Link key={s.href} href={s.href} className={isActive(pathname, s.href) ? "active" : undefined}>
          {s.label}
        </Link>
      ))}
    </nav>
  );
}
