import type { NextConfig } from "next";

/**
 * Origin che possono incorniciare l'app (= quelli da cui si apre HA). Stessa lista
 * usata per il token (HACLEANHOUSE_ALLOWED_PARENT_ORIGINS in lib/env.ts): l'app è
 * comunque funzionale solo da questi origin, quindi limitare qui non rompe nulla.
 * Se apri HA da un nuovo origin (IP LAN, Tailscale), aggiungilo all'env.
 */
function allowedParentOrigins(): string[] {
  const fromEnv = (process.env.HACLEANHOUSE_ALLOWED_PARENT_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return fromEnv.length > 0
    ? fromEnv
    : ["https://home.filippodlc.com", "http://homeassistant:8123"];
}

const nextConfig: NextConfig = {
  // Build autosufficiente per l'immagine Docker (server.js + deps minime)
  output: "standalone",

  // Solo DEV: host da cui il browser carica l'app (iframe HA + dominio Tunnel),
  // autorizzati a richiedere le risorse HMR di Next (/_next/webpack-hmr). Senza
  // questo l'hot-reload è bloccato cross-origin. Ignorato in produzione.
  allowedDevOrigins: ["cleanhouse.filippodlc.com", "homeassistant", "home.filippodlc.com"],

  // Anti-clickjacking: l'app è incorniciata SOLO dal custom panel di HA. Limita gli
  // origin che possono fare framing a quelli noti (no X-Frame-Options: DENY perché
  // l'app DEVE poter essere incorniciata da HA).
  async headers() {
    const frameAncestors = ["'self'", ...allowedParentOrigins()].join(" ");
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: `frame-ancestors ${frameAncestors}` },
        ],
      },
    ];
  },
};

export default nextConfig;
