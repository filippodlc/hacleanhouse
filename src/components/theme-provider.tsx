"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Provider del tema (next-themes).
 *
 * `attribute="class"` → applica la classe `.dark` su <html>, che è ciò che la
 * palette in globals.css si aspetta. `enableSystem` con `defaultTheme="system"`
 * fa sì che, da standalone (app aperta direttamente su :3000), il primo avvio
 * segua `prefers-color-scheme`. Dentro il panel HA il tema viene poi pilotato da
 * <ThemeBridge/> in base a `hass.themes.darkMode`.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
