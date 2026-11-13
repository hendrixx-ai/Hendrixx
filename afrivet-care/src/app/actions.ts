"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/server";
import { APPOINTMENT_STATUSES, formFieldsOf, type TableName } from "@/lib/schema";

/** Tables a user may write to through forms. Attachments only go through /api/upload. */
const EDITABLE = ["pets", "health_records", "appointments", "treatments"] as const;
const DELETABLE = [...EDITABLE, "attachments"] as const;

export interface FormState {
  errors?: Record<string, string>;
  values?: Record<string, string>;
  /** Changes on every successful save so the form can clear itself. */
  savedAt?: number;
}
export interface SaveTarget {
  table: string;
  /** Present when editing an existing row. */
  id?: string;
  /** Where to go after saving; must be a path inside the app. */
  redirectTo?: string;
}

const safePath = (p?: string) => (p && /^\/(?!\/)/.test(p) ? p : undefined);

export async function saveAction(target: SaveTarget, _prev: FormState, formData: FormData): Promise<FormState> {
  const table = EDITABLE.find((t) => t === target.table);
  if (!table) return { errors: { _: "Unknown form" } };
  const { service } = await getContext();

  const input: Record<string, string> = {};
  for (const field of formFieldsOf(table)) {
    const v = formData.get(field.name);
    if (typeof v === "string") input[field.name] = v;
  }

  let destination = safePath(target.redirectTo);
  if (target.id) {
    delete input.pet_id;
    const res = await service.update(table, target.id, input);
    if (!res.ok) return { errors: res.errors, values: input };
  } else {
    const res = await service.create(table, input);
    if (!res.ok) return { errors: res.errors, values: input };
    if (table === "pets") destination = `/pets/${res.row.id}`;
  }

  revalidatePath("/", "layout");
  if (destination) redirect(destination);
  return { savedAt: Date.now() };
}

export async function deleteAction(table: string, id: string, redirectTo?: string): Promise<void> {
  const name = DELETABLE.find((t) => t === table) as TableName | undefined;
  if (!name) return;
  const { service } = await getContext();
  await service.remove(name, id);
  revalidatePath("/", "layout");
  const destination = safePath(redirectTo);
  if (destination) redirect(destination);
}

export async function setAppointmentStatus(id: string, status: string): Promise<void> {
  if (!APPOINTMENT_STATUSES.some((s) => s === status)) return;
  const { service } = await getContext();
  await service.update("appointments", id, { status });
  revalidatePath("/", "layout");
}
