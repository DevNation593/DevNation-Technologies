import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/site";

export const socialImageSize = {
  width: 1200,
  height: 630,
};

export const socialImageAlt = siteConfig.socialImageAlt;

export function createSocialImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#070b14",
          color: "#f8fafc",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          overflow: "hidden",
          position: "relative",
          width: "100%",
        }}
      >
        <div
          style={{
            background: "#2563eb",
            borderRadius: 999,
            display: "flex",
            filter: "blur(90px)",
            height: 360,
            left: -80,
            opacity: 0.35,
            position: "absolute",
            top: -100,
            width: 360,
          }}
        />
        <div
          style={{
            border: "1px solid #1e293b",
            borderRadius: 32,
            display: "flex",
            flexDirection: "column",
            padding: "64px 72px",
            width: 1040,
          }}
        >
          <div style={{ display: "flex", fontSize: 34, fontWeight: 700 }}>
            Dev<span style={{ color: "#3b82f6" }}>Nation</span>
            <span style={{ marginLeft: 10 }}>Technologies</span>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 68,
              fontWeight: 800,
              letterSpacing: -2,
              lineHeight: 1.08,
              marginTop: 34,
              maxWidth: 900,
            }}
          >
            Creamos software a medida
          </div>
          <div
            style={{
              color: "#94a3b8",
              display: "flex",
              fontSize: 26,
              marginTop: 34,
            }}
          >
            Páginas web · Aplicaciones móviles · Sistemas en la nube
          </div>
        </div>
      </div>
    ),
    socialImageSize,
  );
}
