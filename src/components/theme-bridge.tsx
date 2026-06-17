"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

/**
 * Ponte del tema HA → app.
 *
 * Quando l'app gira nel custom panel di HA, il panel (finestra padre) invia via
 * postMessage `{ type: "hacleanhouse-theme", dark }` con lo stato di
 * `hass.themes.darkMode`, sia al boot sia a ogni cambio di tema in HA. Qui
 * applichiamo il tema con next-themes, così HA è la fonte di verità nel panel.
 *
 * Il toggle manuale (<ThemeToggle/>) resta valido come override: HA reinvia solo
 * quando il suo tema cambia, quindi la scelta manuale persiste fino ad allora.
 * Da standalone (nessun padre) non arriva alcun messaggio: vale `defaultTheme`.
 */
export function ThemeBridge() {
  const { setTheme } = useTheme();

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== window.parent) return;
      const data = event.data;
      if (!data || data.type !== "hacleanhouse-theme" || typeof data.dark !== "boolean") {
        return;
      }
      setTheme(data.dark ? "dark" : "light");
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [setTheme]);

  return null;
}
