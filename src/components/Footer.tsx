"use client";

import { Icon } from "@iconify/react";
import Link from "next/link";
import {
  legalLinks,
  navigationLinks,
  siteConfig,
  socialLinks,
} from "@/lib/site";

const technologies = [
  { name: "Node.js", color: "#339933", iconName: "simple-icons:nodedotjs" },
  { name: "Next.js", color: "#FFFFFF", iconName: "simple-icons:nextdotjs" },
  { name: "Docker", color: "#2496ED", iconName: "simple-icons:docker" },
  { name: "AWS", color: "#FF9900", iconName: "simple-icons:amazonwebservices" },
  { name: "PostgreSQL", color: "#4169E1", iconName: "simple-icons:postgresql" },
  { name: "MongoDB", color: "#47A248", iconName: "simple-icons:mongodb" },
] as const;

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-darker border-t border-border">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr] gap-10">
          <div>
            <Link href="/" className="text-xl font-bold tracking-tight">
              Dev<span className="text-accent">Nation</span>593
            </Link>
            <p className="mt-3 text-muted text-sm leading-relaxed max-w-xs">
              Somos un equipo de Quito que crea páginas, aplicaciones y sistemas pensados para cada negocio.
            </p>
            <address className="mt-5 space-y-3 not-italic">
              <div className="flex items-start gap-3">
                <Icon
                  icon="tabler:map-pin"
                  className="w-4 h-4 text-accent mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                <span className="text-muted text-sm">{siteConfig.location}</span>
              </div>
              <div className="flex items-center gap-3">
                <Icon
                  icon="tabler:mail"
                  className="w-4 h-4 text-accent shrink-0"
                  aria-hidden="true"
                />
                <a
                  href={`mailto:${siteConfig.email}`}
                  className="text-muted text-sm hover:text-white transition-colors"
                >
                  {siteConfig.email}
                </a>
              </div>
            </address>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider mb-4">
              Navegación
            </h2>
            <ul className="space-y-3">
              {[...navigationLinks, { href: "/contacto", label: "Contacto" }].map(
                (link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-muted text-sm hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider mb-4">
              Legal
            </h2>
            <ul className="space-y-3">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-muted text-sm hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>

            <h2 className="text-sm font-semibold uppercase tracking-wider mt-8 mb-4">
              Síguenos
            </h2>
            <div className="flex items-center gap-3">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 bg-card border border-border rounded-lg flex items-center justify-center hover:border-accent/40 transition-colors"
                  aria-label={social.label}
                >
                  <Icon
                    icon={social.iconName}
                    className="w-4 h-4 text-muted hover:text-white transition-colors"
                    aria-hidden="true"
                  />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border">
          <p className="text-xs text-muted uppercase tracking-wider font-semibold mb-4 text-center">
            Herramientas que usamos
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6">
            {technologies.map((tech) => (
              <div
                key={tech.name}
                className="flex items-center gap-2 text-muted hover:text-white transition-colors"
                title={tech.name}
              >
                <Icon
                  icon={tech.iconName}
                  className="w-5 h-5"
                  style={{ color: tech.color }}
                  aria-hidden="true"
                />
                <span className="text-xs font-medium">{tech.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-border">
          <p className="text-muted text-sm text-center sm:text-left">
            &copy; {currentYear} {siteConfig.name}. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
