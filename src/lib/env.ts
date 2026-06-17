// Lettura centralizzata delle variabili d'ambiente (solo lato server).

export const env = {
  // Base URL di Home Assistant raggiungibile dal *server* dell'app.
  // In Docker (bridge) -> host.docker.internal; in dev locale -> IP LAN.
  haBaseUrl: process.env.HA_BASE_URL ?? "http://host.docker.internal:8123",

  // entity_id del calendario Google in HA (es. calendar.famiglia). Punto aperto del DESIGN.
  haCalendarEntity: process.env.HA_CALENDAR_ENTITY ?? "",

  // Segreto per cifrare il cookie di sessione (iron-session, >= 32 char).
  sessionSecret:
    process.env.SESSION_SECRET ??
    "dev-session-secret-change-me-please-32+chars",

  // In sviluppo: se valorizzato, bypassa la verifica del token HA usando questo haUserId.
  devHaUserId: process.env.DEV_HA_USER_ID ?? "",

  isProd: process.env.NODE_ENV === "production",
};

/** URL WebSocket di HA derivato dalla base URL (http->ws, https->wss). */
export function haWebsocketUrl(): string {
  const base = new URL(env.haBaseUrl);
  base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
  base.pathname = "/api/websocket";
  return base.toString();
}
