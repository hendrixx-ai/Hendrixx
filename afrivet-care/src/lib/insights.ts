import { dueStatus, nowLocal, type DueStatus } from "./dates";
import type { Appointment, Treatment } from "./schema";

export interface DueItem {
  treatment: Treatment;
  status: Exclude<DueStatus, "none" | "later">;
}

/**
 * Vaccinations and medications that are overdue or due within 30 days.
 * Only the most recent entry for each pet + treatment counts, so logging a
 * booster clears the reminder raised by the previous dose.
 */
export function dueTreatments(treatments: Treatment[], today: string): DueItem[] {
  const latest = new Map<string, Treatment>();
  for (const t of treatments) {
    const key = `${t.pet_id}|${t.type}|${t.name.trim().toLowerCase()}`;
    const seen = latest.get(key);
    if (!seen || t.given_on > seen.given_on) latest.set(key, t);
  }
  const items: DueItem[] = [];
  for (const treatment of latest.values()) {
    const status = dueStatus(treatment.next_due_on, today);
    if (status === "overdue" || status === "soon") items.push({ treatment, status });
  }
  return items.sort((a, b) => a.treatment.next_due_on!.localeCompare(b.treatment.next_due_on!));
}

/** Scheduled appointments that have not started yet, soonest first. */
export function upcomingAppointments(appointments: Appointment[], now: string): Appointment[] {
  return appointments
    .filter((a) => a.status === "scheduled" && a.scheduled_at >= now)
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
}

/** Scheduled appointments whose time has passed without being completed or cancelled. */
export function missedAppointments(appointments: Appointment[], now: string): Appointment[] {
  return appointments.filter((a) => a.status === "scheduled" && a.scheduled_at < now);
}

export { nowLocal };
