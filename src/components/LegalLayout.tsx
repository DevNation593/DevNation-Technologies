"use client";

import Link from "next/link";
import { Icon } from "@iconify/react";
import { legalLinks } from "@/lib/site";

interface LegalLayoutProps {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}

export default function LegalLayout({ title, lastUpdated, children }: LegalLayoutProps) {
  return (
    <div className="min-h-screen bg-darker text-white">
      {/* Header */}
      <header className="bg-primary border-b border-border">
        <div className="mx-auto max-w-4xl px-6 py-6 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-tight">
            Dev<span className="text-accent">Nation</span>593
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-muted hover:text-white transition-colors"
          >
            <Icon icon="tabler:arrow-left" className="w-4 h-4" />
            Volver al inicio
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="text-3xl md:text-4xl font-bold mb-3">{title}</h1>
        <p className="text-muted text-sm mb-10">
          Última actualización: {lastUpdated}
        </p>

        <div className="prose prose-invert prose-sm max-w-none space-y-8 text-slate-300 leading-relaxed [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-white [&_h2]:mt-10 [&_h2]:mb-4 [&_h3]:text-lg [&_h3]:font-medium [&_h3]:text-white [&_h3]:mt-6 [&_h3]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-2 [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-accent-hover [&_strong]:text-white">
          {children}
        </div>

        {/* Navigation between legal pages */}
        <div className="mt-16 pt-8 border-t border-border">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted mb-4">
            Documentos legales
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {legalLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-2 text-sm text-muted hover:text-white transition-colors p-3 rounded-lg bg-card border border-border hover:border-accent/40"
              >
                <Icon icon="tabler:file-text" className="w-4 h-4 text-accent shrink-0" />
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-primary">
        <div className="mx-auto max-w-4xl px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-muted text-sm">
            &copy; {new Date().getFullYear()} DevNation593. Todos los derechos reservados.
          </p>
          <Link href="/" className="text-sm text-accent hover:text-accent-hover transition-colors">
            devnation593.com
          </Link>
        </div>
      </footer>
    </div>
  );
}
