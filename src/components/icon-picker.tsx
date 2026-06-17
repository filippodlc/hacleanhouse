"use client";

import { RoomIcon } from "@/components/room-icon";
import { Input } from "@/components/ui/input";
import { MDI_ICON_NAMES, normalizeRoomIcon } from "@/lib/mdi-icons";
import { cn } from "@/lib/utils";
import { Popover as PopoverPrimitive } from "radix-ui";
import { useMemo, useState } from "react";

// Limite di icone mostrate per mantenere fluido il rendering (la collezione ne ha ~7600).
const MAX_RESULTS = 180;

/** Estrae il nome leggibile da "mdi:broom" -> "broom". */
function shortName(icon: string): string {
  const i = icon.indexOf(":");
  return i === -1 ? icon : icon.slice(i + 1);
}

/**
 * Combobox di ricerca su tutte le icone Material Design (stile Home Assistant).
 * Salva il valore nel formato "mdi:...".
 */
export function IconPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (icon: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const current = normalizeRoomIcon(value);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return MDI_ICON_NAMES.slice(0, MAX_RESULTS);
    const matches: string[] = [];
    for (const name of MDI_ICON_NAMES) {
      if (name.includes(q)) {
        matches.push(name);
        if (matches.length >= MAX_RESULTS) break;
      }
    }
    return matches;
  }, [query]);

  function select(icon: string) {
    onChange(icon);
    setOpen(false);
    setQuery("");
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-9 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors",
            "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          )}
        >
          <RoomIcon icon={current} className="size-5" />
          <span className="flex-1 truncate text-left">{shortName(current)}</span>
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          className={cn(
            "z-50 w-(--radix-popover-trigger-width) min-w-72 rounded-md border bg-popover p-2 text-popover-foreground shadow-md outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        >
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca icona…"
            className="mb-2 h-8"
          />
          {results.length === 0 ? (
            <p className="px-1 py-6 text-center text-sm text-muted-foreground">
              Nessuna icona trovata.
            </p>
          ) : (
            <div className="grid max-h-64 grid-cols-6 gap-1 overflow-y-auto">
              {results.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  title={shortName(icon)}
                  onClick={() => select(icon)}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-md hover:bg-muted",
                    icon === current && "bg-primary/15 ring-1 ring-primary",
                  )}
                >
                  <RoomIcon icon={icon} className="size-5" />
                </button>
              ))}
            </div>
          )}
          <p className="mt-1 px-1 text-[11px] text-muted-foreground">
            {query.trim()
              ? `${results.length}${results.length >= MAX_RESULTS ? "+" : ""} risultati`
              : "Digita per cercare tra tutte le icone MDI"}
          </p>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
