"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

const noop = () => () => {};

/**
 * Toggle manuale chiaro/scuro. Override locale rispetto al tema ereditato da HA.
 * `resolvedTheme` è noto solo lato client: finché non siamo idratati mostriamo un
 * placeholder della stessa dimensione per evitare mismatch di hydration.
 * `useSyncExternalStore` distingue server (false) da client (true) senza
 * chiamare setState dentro un effect (vietato dalla nuova regola eslint).
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(noop, () => true, () => false);

  if (!mounted) {
    return <Button variant="ghost" size="icon" aria-hidden className="opacity-0" />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? "Tema chiaro" : "Tema scuro"}
      title={isDark ? "Tema chiaro" : "Tema scuro"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
