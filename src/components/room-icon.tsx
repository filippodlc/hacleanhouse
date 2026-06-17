"use client";

import { normalizeRoomIcon } from "@/lib/mdi-icons";
import { cn } from "@/lib/utils";
import { Icon } from "@iconify/react";

/**
 * Render di un'icona Material Design a partire dalla stringa "mdi:..." salvata sulla stanza.
 * La collezione MDI è registrata offline (vedi src/lib/mdi-icons.ts).
 */
export function RoomIcon({
  icon,
  className,
}: {
  icon?: string | null;
  className?: string;
}) {
  return (
    <Icon
      icon={normalizeRoomIcon(icon)}
      className={cn("size-4 shrink-0", className)}
      aria-hidden
    />
  );
}
