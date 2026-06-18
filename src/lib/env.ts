// Lettura centralizzata delle variabili d'ambiente (solo lato server).

/** Parsa una lista separata da virgole in array di stringhe non vuote e trimmate. */
function parseList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

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

  // Allowlist di haUserId che possono essere PROVISIONATI al primo accesso.
  // Un utente HA senza Member già esistente entra solo se è in questa lista
  // (bootstrap del primo utente). Gli altri Member si aggiungono dalla UI Gestione.
  allowedHaUserIds: parseList(process.env.HACLEANHOUSE_ALLOWED_HA_USERS),

  // Origin (schema+host[:porta]) che possono incorniciare l'app e inviarle il
  // token via postMessage. Default: HA locale + dominio pubblico del tunnel.
  // Aggiungi qui eventuali altri origin da cui apri HA (es. IP LAN, Tailscale).
  allowedParentOrigins: (() => {
    const fromEnv = parseList(process.env.HACLEANHOUSE_ALLOWED_PARENT_ORIGINS);
    return fromEnv.length > 0
      ? fromEnv
      : ["https://home.filippodlc.com", "http://homeassistant:8123"];
  })(),

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
