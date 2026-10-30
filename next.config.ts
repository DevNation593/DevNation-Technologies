import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // libxml2-wasm trae el binario wasm embebido; se carga desde node_modules sin empaquetar.
  serverExternalPackages: ["libxml2-wasm"],
  // Esquemas XSD del SRI que src/lib/sri/schema.ts lee en tiempo de ejecución.
  outputFileTracingIncludes: {
    "/admin/**/*": ["./src/lib/sri/xsd/*.xsd"],
  },
  async redirects() {
    return [
      {
        source: "/proteccion-datos",
        destination: "/politica-privacidad",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
