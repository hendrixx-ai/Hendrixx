import { fieldsOf, type Field, type TableName, type Values } from "./schema";

export type ValidationResult =
  | { ok: true; values: Values }
  | { ok: false; errors: Record<string, string> };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

function realDate(v: string) {
  const d = new Date(`${v.slice(0, 10)}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v.slice(0, 10);
}

function check(field: Field, raw: string): { value: string | number } | { error: string } {
  switch (field.type) {
    case "date":
      return DATE.test(raw) && realDate(raw) ? { value: raw } : { error: "Enter a valid date" };
    case "datetime": {
      const v = raw.slice(0, 16);
      const [h, m] = [Number(v.slice(11, 13)), Number(v.slice(14, 16))];
      return DATETIME.test(v) && realDate(v) && h < 24 && m < 60
        ? { value: v }
        : { error: "Enter a valid date and time" };
    }
    case "number": {
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) return { error: "Enter a positive number" };
      if (field.max !== undefined && n > field.max) return { error: `Must be ${field.max} or less` };
      return { value: n };
    }
    case "select":
      return field.options?.includes(raw) ? { value: raw } : { error: "Choose one of the options" };
    case "pet":
      return isUuid(raw) ? { value: raw } : { error: "Choose a pet" };
    default: {
      const max = field.max ?? 200;
      return raw.length > max ? { error: `Keep this under ${max} characters` } : { value: raw };
    }
  }
}

/**
 * Validates untrusted input against a table definition. Only fields in `allow`
 * (default: the fields a user may edit) are read; anything else is ignored.
 */
export function validate(
  table: TableName,
  input: Record<string, unknown>,
  opts: { includeInternal?: boolean; partial?: boolean } = {},
): ValidationResult {
  const values: Values = {};
  const errors: Record<string, string> = {};
  for (const field of fieldsOf(table)) {
    if (field.internal && !opts.includeInternal) continue;
    const given = input[field.name];
    if (opts.partial && given === undefined) continue;
    const raw = given === null || given === undefined ? "" : String(given).trim();
    if (raw === "") {
      if (field.required) errors[field.name] = `${field.label} is required`;
      else values[field.name] = null;
      continue;
    }
    const res = check(field, raw);
    if ("error" in res) errors[field.name] = res.error;
    else values[field.name] = res.value;
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, values };
}
