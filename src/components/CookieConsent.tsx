"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Script from "next/script";
import {
  type CookieConsentChoice,
  saveCookieConsent,
  useCookieConsent,
  useCookiePreferencesOpen,
} from "@/lib/cookie-consent";
import { siteConfig } from "@/lib/site";

const analyticsId = siteConfig.analyticsId;

function clearAnalyticsCookies() {
  const names = document.cookie
    .split("; ")
    .map((cookie) => cookie.split("=")[0])
    .filter((name) => name === "_ga" || name.startsWith("_ga_"));
  const hostParts = window.location.hostname.split(".");
  const domains = hostParts.map((_, index) => hostParts.slice(index).join("."));

  for (const name of names) {
    document.cookie = `${name}=; Max-Age=0; Path=/`;
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; Path=/; Domain=.${domain}`;
    }
  }
}

function choose(choice: CookieConsentChoice) {
  if (analyticsId) {
    (window as unknown as Record<string, boolean>)[`ga-disable-${analyticsId}`] =
      choice === "denied";
  }
  if (choice === "denied") {
    clearAnalyticsCookies();
  }
  saveCookieConsent(choice);
}

export default function CookieConsent() {
  const consent = useCookieConsent();
  const preferencesOpen = useCookiePreferencesOpen();
  const pathname = usePathname();

  // El panel administrativo no carga analítica ni muestra el aviso.
  if (pathname?.startsWith("/admin")) return null;

  return (
    <>
      {analyticsId && consent === "granted" && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${analyticsId}`}
            strategy="afterInteractive"
          />
          <Script id="google-analytics" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${analyticsId}', { allow_google_signals: false, allow_ad_personalization_signals: false });`}
          </Script>
        </>
      )}

      {(consent === "unset" || preferencesOpen) && (
        <section
          aria-label="Aviso de cookies"
          className="fixed bottom-0 inset-x-0 z-50 p-4 sm:p-6 pointer-events-none"
        >
          <div className="pointer-events-auto mx-auto max-w-3xl flex flex-col md:flex-row md:items-center gap-4 p-5 bg-card rounded-2xl border border-white/10 shadow-2xl shadow-black/50">
            <p className="text-sm text-muted leading-relaxed">
              Usamos una cookie necesaria para recordar tu decisión y, solo si
              aceptas, cookies de Google Analytics para saber cómo se usa el
              sitio. No mostramos publicidad. Lee más en nuestra{" "}
              <Link
                href="/politica-cookies"
                className="text-accent underline underline-offset-2 hover:text-accent-hover transition-colors"
              >
                Política de cookies
              </Link>
              .
            </p>
            <div className="shrink-0 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => choose("denied")}
                className="border border-muted/50 hover:border-white text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors duration-200 cursor-pointer"
              >
                Rechazar
              </button>
              <button
                type="button"
                onClick={() => choose("granted")}
                className="bg-accent hover:bg-accent-hover text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors duration-200 cursor-pointer"
              >
                Aceptar
              </button>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
