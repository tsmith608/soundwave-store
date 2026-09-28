/** Date parsing and typesetting helpers. Customers may type anything; ISO dates get nicer treatment. */

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function parseDate(input: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
  return Number.isNaN(d.getTime()) ? null : d;
}

export type DateStyle = "long" | "dots" | "slashes" | "monthYear" | "year" | "spaced";

export function formatDate(input: string, style: DateStyle = "long"): string {
  const d = parseDate(input);
  if (!d) return input.trim();
  const y = d.getUTCFullYear();
  const mo = d.getUTCMonth();
  const day = d.getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  switch (style) {
    case "dots":
      return `${pad(mo + 1)}.${pad(day)}.${y}`;
    case "slashes":
      return `${pad(mo + 1)} / ${pad(day)} / ${y}`;
    case "monthYear":
      return `${MONTHS[mo]} ${y}`;
    case "year":
      return String(y);
    case "spaced":
      return `${pad(mo + 1)} · ${pad(day)} · ${String(y).slice(2)}`;
    default:
      return `${MONTHS[mo]} ${day}, ${y}`;
  }
}

/**
 * Moon phase for a date (0 = new, 0.5 = full), using the mean synodic month
 * from a known new moon (2000-01-06 18:14 UTC). Accurate to well under a day,
 * which is all an illustration needs.
 */
export function moonPhase(date: Date): number {
  const synodic = 29.530588853;
  const known = Date.UTC(2000, 0, 6, 18, 14);
  const days = (date.getTime() - known) / 86400000;
  return (((days % synodic) + synodic) % synodic) / synodic;
}

export function moonPhaseName(phase: number): string {
  const names = ["New Moon", "Waxing Crescent", "First Quarter", "Waxing Gibbous", "Full Moon", "Waning Gibbous", "Last Quarter", "Waning Crescent"];
  return names[Math.round(phase * 8) % 8];
}
