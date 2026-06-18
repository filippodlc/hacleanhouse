import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { validateHaToken } from "@/lib/ha";
import type { House, Member } from "@prisma/client";
import { getIronSession, type IronSession } from "iron-session";
import { cookies } from "next/headers";
import { cache } from "react";
import "server-only";

export type SessionData = {
  memberId?: string;
  haUserId?: string;
  // Ultimo access token HA inoltrato dal panel: usato per chiamare HA (calendario)
  // come l'utente loggato. Si rinnova ad ogni postMessage del panel.
  haAccessToken?: string;
};

const sessionOptions = {
  password: env.sessionSecret,
  cookieName: "hacleanhouse_session",
  cookieOptions: {
    httpOnly: true,
    sameSite: "lax" as const,
    // L'app è servita in HTTP sulla rete privata (LAN/Tailscale): un cookie
    // Secure verrebbe scartato dal browser su http:// -> sessione persa
    // ("Non autenticato"). Stesso motivo di N8N_SECURE_COOKIE=false.
    // HA e l'app condividono lo stesso host (porte diverse = stesso "site"),
    // quindi SameSite=Lax basta nell'iframe.
    secure: false,
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

/**
 * Assicura che esista una "Casa" di default a cui agganciare i nuovi membri
 * al primo accesso (provisioning). MVP: singola casa condivisa.
 */
export async function ensureDefaultHouse(): Promise<House> {
  const existing = await prisma.house.findFirst({ orderBy: { createdAt: "asc" } });
  if (existing) return existing;
  return prisma.house.create({ data: { name: "Casa" } });
}

/**
 * Trova (o crea al primo accesso) il Member legato a un utente HA.
 * NB: usato solo dal mock di sviluppo. Per il login reale usare `provisionMember`,
 * che applica il controllo d'accesso (allowlist).
 */
async function createBootstrapMember(
  haUserId: string,
  displayName: string,
  houseId: string,
): Promise<Member> {
  // Il primo membro di una casa diventa admin (bootstrap): senza questo nessuno
  // potrebbe gestire i membri (le mutazioni sono riservate agli admin).
  const isFirst = (await prisma.member.count({ where: { houseId } })) === 0;
  return prisma.member.create({
    data: { haUserId, displayName, houseId, isAdmin: isFirst },
  });
}

export async function getOrCreateMember(
  haUserId: string,
  displayName: string,
): Promise<Member> {
  const found = await prisma.member.findUnique({ where: { haUserId } });
  if (found) return found;
  const house = await ensureDefaultHouse();
  return createBootstrapMember(haUserId, displayName, house.id);
}

/**
 * Risolve il Member per un utente HA applicando il controllo d'accesso:
 *  - se esiste già un Member per quell'haUserId -> accesso consentito;
 *  - altrimenti il provisioning avviene SOLO se l'haUserId è in allowlist
 *    (`HACLEANHOUSE_ALLOWED_HA_USERS`); in caso contrario ritorna `null`.
 * Questo evita che qualunque utente HA ottenga automaticamente accesso una volta
 * che l'app è esposta. Nuovi membri si aggiungono dalla UI Gestione (admin).
 */
export async function provisionMember(
  haUserId: string,
  displayName: string,
): Promise<Member | null> {
  const found = await prisma.member.findUnique({ where: { haUserId } });
  if (found) return found;
  if (!env.allowedHaUserIds.includes(haUserId)) return null;
  const house = await ensureDefaultHouse();
  return createBootstrapMember(haUserId, displayName, house.id);
}

/**
 * Stabilisce la sessione a partire da un access token HA (flusso del panel):
 * valida il token, ricava l'utente certo, applica il controllo d'accesso e salva
 * la sessione. Ritorna il Member oppure null se il token non è valido o l'utente
 * non è autorizzato.
 */
export async function loginWithHaToken(token: string): Promise<Member | null> {
  const haUser = await validateHaToken(token);
  if (!haUser) return null;
  const member = await provisionMember(haUser.haUserId, haUser.name);
  if (!member) return null;
  const session = await getSession();
  session.memberId = member.id;
  session.haUserId = member.haUserId;
  session.haAccessToken = token;
  await session.save();
  return member;
}

/**
 * Ritorna il Member loggato, oppure null.
 * In sviluppo, se DEV_HA_USER_ID è impostato, esegue un auto-login mock
 * (nessuna verifica del token) così si lavora subito su UI/dati.
 */
// Memoizzato per-richiesta: layout e page lo chiamano entrambi nello stesso
// render -> una sola lettura sessione + query DB invece di due.
export const getCurrentMember = cache(async (): Promise<Member | null> => {
  const session = await getSession();
  if (session.memberId) {
    const member = await prisma.member.findUnique({ where: { id: session.memberId } });
    if (member) return member;
  }

  if (!env.isProd && env.devHaUserId) {
    // Mock dev: nessun save() qui (il render di un Server Component non può
    // scrivere cookie). Il membro è risolto da env ad ogni richiesta.
    return getOrCreateMember(env.devHaUserId, "Dev User");
  }

  return null;
});

/** Come getCurrentMember ma lancia se non autenticato (per Server Actions/route protette). */
export async function requireMember(): Promise<Member> {
  const member = await getCurrentMember();
  if (!member) throw new Error("Non autenticato");
  return member;
}

/**
 * Come requireMember ma richiede anche il ruolo admin. Usato per la gestione dei
 * membri: aggiungere un Member equivale a concedere accesso all'app a un utente HA,
 * quindi non deve essere consentito a qualunque membro.
 */
export async function requireAdmin(): Promise<Member> {
  const member = await requireMember();
  if (!member.isAdmin) throw new Error("Operazione riservata agli amministratori");
  return member;
}

/** Token HA corrente in sessione (per chiamate al calendario). */
export async function getHaAccessToken(): Promise<string | null> {
  const session = await getSession();
  return session.haAccessToken ?? null;
}
