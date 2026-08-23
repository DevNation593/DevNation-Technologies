import type { Metadata } from "next";
import { siteConfig } from "@/lib/site";

interface PageMetadataOptions {
  title: string;
  description: string;
  path: `/${string}` | "/";
  noIndex?: boolean;
}

export function createPageMetadata({
  title,
  description,
  path,
  noIndex = false,
}: PageMetadataOptions): Metadata {
  const fullTitle = `${title} | ${siteConfig.name}`;

  return {
    title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title: fullTitle,
      description,
      url: path,
      siteName: siteConfig.name,
      locale: siteConfig.locale,
      type: "website",
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: siteConfig.socialImageAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [
        {
          url: "/twitter-image",
          alt: siteConfig.socialImageAlt,
        },
      ],
    },
    ...(noIndex
      ? {
          robots: {
            index: false,
            follow: true,
            googleBot: {
              index: false,
              follow: true,
            },
          },
        }
      : {}),
  };
}
