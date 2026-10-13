const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
const configuredContactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();
const configuredAnalyticsId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();

export const siteConfig = {
  name: "DevNation Technologies",
  url: configuredSiteUrl || "https://devnation.tech",
  locale: "es_EC",
  language: "es-EC",
  email: configuredContactEmail || "contacto@devnation.tech",
  location: "Quito, Ecuador",
  analyticsId:
    configuredAnalyticsId && /^G-[A-Z0-9]+$/.test(configuredAnalyticsId)
      ? configuredAnalyticsId
      : undefined,
  title: "Desarrollo de software a medida en Ecuador | DevNation Technologies",
  description:
    "Creamos páginas web, aplicaciones móviles y sistemas a medida para empresas de Ecuador y Latinoamérica.",
  socialImageAlt: "DevNation Technologies — Desarrollo de software a medida en Ecuador",
  social: {
    github: "https://github.com/devnation593",
    linkedin: "https://linkedin.com/company/devnation593",
  },
} as const;

export const cookieConsent = {
  name: "dn_cookie_consent",
  maxAgeDays: 180,
} as const;

export const navigationLinks = [
  { href: "/#about", label: "Nosotros" },
  { href: "/mision-vision", label: "Misión y visión" },
  { href: "/#services", label: "Servicios" },
  { href: "/portafolio", label: "Portafolio" },
  { href: "/#why-us", label: "Por qué elegirnos" },
] as const;

export const legalLinks = [
  { href: "/politica-privacidad", label: "Política de privacidad" },
  { href: "/terminos-condiciones", label: "Términos y condiciones" },
  { href: "/politica-cookies", label: "Política de cookies" },
] as const;

export const socialLinks = [
  {
    href: siteConfig.social.github,
    label: "GitHub",
    iconName: "simple-icons:github",
  },
  {
    href: siteConfig.social.linkedin,
    label: "LinkedIn",
    iconName: "simple-icons:linkedin",
  },
] as const;
