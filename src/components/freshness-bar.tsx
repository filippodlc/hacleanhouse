import { cn } from "@/lib/utils";

/** Classe colore (bg-*) per soglia di freschezza (rosso se in ritardo). */
export function freshnessColor(value: number, overdueDays = 0): string {
  if (overdueDays > 0 || value <= 0.25) return "bg-red-500";
  if (value <= 0.5) return "bg-orange-500";
  if (value <= 0.75) return "bg-yellow-500";
  return "bg-emerald-500";
}

/** Stato "parlante" della pulizia (al posto della percentuale). */
export function freshnessLabel(value: number, overdueDays = 0): string {
  if (overdueDays > 0 || value <= 0.2) return "Urgente";
  if (value <= 0.4) return "Al lavoro";
  if (value <= 0.6) return "Va abbastanza bene";
  if (value <= 0.8) return "Ci siamo";
  return "Sta brillando";
}

/**
 * Barra "stato pulizia": piena (verde) subito dopo una pulizia, si svuota fino a
 * zero (rosso) alla scadenza. Componente puramente presentazionale (nessuno
 * stato/hook) → utilizzabile da server component.
 */
export function FreshnessBar({
  value,
  overdueDays = 0,
  className,
}: {
  value: number;
  overdueDays?: number;
  className?: string;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  // Quasi vuoto / in ritardo: track tinto di rosso e nub più largo, così lo
  // "0%" resta ben visibile invece di sparire.
  const urgent = overdueDays > 0 || value <= 0.05;
  return (
    <div
      className={cn(
        "h-2 w-full overflow-hidden rounded-full",
        urgent ? "bg-red-500/25" : "bg-muted",
        className,
      )}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-full transition-all", freshnessColor(value, overdueDays))}
        style={{ width: `${pct}%`, minWidth: urgent ? "1.25rem" : "0.5rem" }}
      />
    </div>
  );
}
