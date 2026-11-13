/**
 * Dates are stored as plain calendar values ("2026-11-20") and appointment times as
 * clinic wall-clock time ("2026-11-20T09:30"), so they read the same for everyone.
 * "Now" is therefore computed in the clinic's timezone (APP_TIMEZONE).
 */
export function nowLocal(timezone: string, at: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export const todayLocal = (timezone: string, at?: Date) => nowLocal(timezone, at).slice(0, 10);

const utc = (date: string) => new Date(`${date.slice(0, 10)}T00:00:00Z`);

export function addDays(date: string, days: number): string {
  const d = utc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const daysBetween = (from: string, to: string) =>
  Math.round((utc(to).getTime() - utc(from).getTime()) / 86_400_000);

export function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  const text = utc(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return text.replace(/ /g, "\u00a0"); // non-breaking, so a date never wraps mid-way
}

export function formatDateTime(value: string): string {
  const d = new Date(`${value.slice(0, 16)}:00Z`);
  const day = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  return `${day}, ${value.slice(11, 16)}`;
}

export function ageLabel(birthDate: string | null, today: string): string | null {
  if (!birthDate || birthDate > today) return null;
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  let months = (ty - by) * 12 + (tm - bm) - (td < bd ? 1 : 0);
  if (months < 1) return `${Math.max(daysBetween(birthDate, today), 0)} days`;
  if (months < 24) return `${months} mo`;
  months -= months % 12;
  return `${months / 12} yr`;
}

export type DueStatus = "overdue" | "soon" | "later" | "none";

/** "soon" means due within the next 30 days (today included). */
export function dueStatus(nextDue: string | null, today: string): DueStatus {
  if (!nextDue) return "none";
  if (nextDue < today) return "overdue";
  return daysBetween(today, nextDue) <= 30 ? "soon" : "later";
}

export function dueLabel(nextDue: string, today: string): string {
  const n = daysBetween(today, nextDue);
  if (n === 0) return "Due today";
  if (n === 1) return "Due tomorrow";
  if (n === -1) return "1 day overdue";
  return n < 0 ? `${-n} days overdue` : `Due in ${n} days`;
}
