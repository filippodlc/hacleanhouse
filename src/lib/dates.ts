export const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Mezzanotte UTC della data (azzera l'orario). */
export function dateOnlyUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Differenza in giorni interi tra due date (a - b). */
export function diffDays(a: Date, b: Date): number {
  return Math.round((dateOnlyUTC(a).getTime() - dateOnlyUTC(b).getTime()) / MS_PER_DAY);
}

/** Date → stringa "YYYY-MM-DD" (UTC). */
export function isoDate(d: Date): string {
  return dateOnlyUTC(d).toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" → Date a mezzanotte UTC (compatibile con le colonne @db.Date). */
export function parseDateUTC(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}
