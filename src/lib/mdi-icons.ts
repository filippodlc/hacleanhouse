import mdiCollection from "@iconify-json/mdi/icons.json";
import { addCollection, type IconifyJSON } from "@iconify/react";

// Registra l'intera collezione Material Design Icons in locale, così <Icon icon="mdi:..." />
// renderizza completamente offline (nessuna chiamata all'API Iconify).
const collection = mdiCollection as IconifyJSON;
addCollection(collection);

// Prefisso della collezione (es. "mdi") e default usato quando una stanza non ha icona.
export const MDI_PREFIX = collection.prefix;
export const DEFAULT_ROOM_ICON = `${MDI_PREFIX}:broom`;

// Elenco di tutti i nomi icona nel formato "mdi:broom", usato dal picker di ricerca.
export const MDI_ICON_NAMES: string[] = Object.keys(collection.icons).map(
  (name) => `${MDI_PREFIX}:${name}`,
);

/** Normalizza un valore icona in una stringa "mdi:..." valida, con fallback. */
export function normalizeRoomIcon(icon?: string | null): string {
  const trimmed = icon?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_ROOM_ICON;
}
