import { loginWithHaToken } from "@/lib/auth";
import { NextResponse } from "next/server";

// La sessione dipende da cookie/token: mai cachare.
export const dynamic = "force-dynamic";

/**
 * Endpoint di login del panel.
 *
 * Riceve l'access token HA inoltrato dall'iframe (vedi auth-bridge.tsx), lo
 * valida lato server contro Home Assistant (`loginWithHaToken` -> WebSocket
 * `auth/current_user`) e, se l'utente è autorizzato, crea la sessione cifrata.
 *
 * Sicurezza: ci si fida ESCLUSIVAMENTE del token validato dal server, mai di
 * un'identità passata dal client. Nessuna informazione sull'utente viene
 * restituita oltre all'esito.
 */
export async function POST(request: Request) {
  let token: unknown;
  try {
    const body = await request.json();
    token = body?.token;
  } catch {
    return NextResponse.json({ ok: false, error: "Body non valido" }, { status: 400 });
  }

  if (typeof token !== "string" || token.length === 0) {
    return NextResponse.json({ ok: false, error: "Token mancante" }, { status: 400 });
  }

  const member = await loginWithHaToken(token);
  if (!member) {
    // Token non valido oppure utente non autorizzato (non in allowlist / non membro).
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
