import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
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
