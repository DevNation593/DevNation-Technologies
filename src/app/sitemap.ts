import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";

const routes = [
  { path: "", changeFrequency: "monthly", priority: 1 },
  { path: "/portafolio", changeFrequency: "monthly", priority: 0.8 },
  { path: "/mision-vision", changeFrequency: "yearly", priority: 0.6 },
  { path: "/contacto", changeFrequency: "yearly", priority: 0.7 },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map(({ path, changeFrequency, priority }) => ({
    url: `${siteConfig.url}${path}`,
    changeFrequency,
    priority,
  }));
}

