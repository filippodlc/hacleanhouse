"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Ponte di autenticazione lato client.
 *
 * Quando l'app è incapsulata nel custom panel di HA, il panel (finestra padre)
 * invia via postMessage l'utente HA e un access token a vita breve. Qui:
 *  1. al mount segnaliamo al padre che siamo pronti (`hacleanhouse-ready`);
 *  2. ricevuto il token (`hacleanhouse-auth`), lo POSTiamo a /api/session che lo
 *     valida lato server e crea/aggiorna la sessione; poi refresh dei dati.
 *
 * Il token viene comunque validato dal server: i controlli qui sono solo difensivi.
 * In sviluppo (app aperta direttamente) nessun messaggio arriva e si usa il dev mock.
 */
export function AuthBridge({ allowedOrigins = [] }: { allowedOrigins?: string[] }) {
  const router = useRouter();
  const lastToken = useRef<string | null>(null);

  useEffect(() => {
    async function onMessage(event: MessageEvent) {
      // Accetta solo messaggi del nostro protocollo provenienti dalla finestra padre...
      if (event.source !== window.parent) return;
      // ...e solo da un origin esplicitamente autorizzato (anti clickjacking / relay):
      // un eventuale frame padre ostile non deve poter iniettare un token.
      if (allowedOrigins.length > 0 && !allowedOrigins.includes(event.origin)) return;
      const data = event.data;
      if (!data || data.type !== "hacleanhouse-auth" || typeof data.token !== "string") {
        return;
      }
      if (data.token === lastToken.current) return; // evita ricarichi inutili
      lastToken.current = data.token;

      try {
        const res = await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: data.token }),
        });
        if (res.ok) router.refresh();
      } catch {
        /* il server gestisce gli errori; in dev si usa il mock */
      }
    }

    window.addEventListener("message", onMessage);
    // Segnala al panel che l'iframe è pronto a ricevere identità + token.
    if (window.parent !== window) {
      window.parent.postMessage({ type: "hacleanhouse-ready" }, "*");
    }
    return () => window.removeEventListener("message", onMessage);
  }, [router]);

  return null;
}
