import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build autosufficiente per l'immagine Docker (server.js + deps minime)
  output: "standalone",
};

export default nextConfig;
