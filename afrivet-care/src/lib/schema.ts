/**
 * The data model, described once. Forms, validation, the in-memory demo store and
 * the SQL driver are all generated from these definitions. db/schema.sql must match.
 */
export type FieldType = "text" | "longtext" | "date" | "datetime" | "number" | "select" | "pet";

export interface Field {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: readonly string[];
  max?: number;
  placeholder?: string;
  /** Not shown in forms; set by the server. */
  internal?: boolean;
}

export const SPECIES = ["dog", "cat", "cattle", "goat", "sheep", "poultry", "donkey", "other"] as const;
export const RECORD_KINDS = ["checkup", "illness", "injury", "surgery", "lab result", "other"] as const;
export const APPOINTMENT_STATUSES = ["scheduled", "completed", "cancelled"] as const;
export const TREATMENT_TYPES = ["vaccination", "medication"] as const;

const pet: Field = { name: "pet_id", label: "Pet", type: "pet", required: true };
const notes: Field = { name: "notes", label: "Notes", type: "longtext", max: 2000 };

export const TABLES = {
  pets: {
    orderBy: "name",
    fields: [
      { name: "name", label: "Name", type: "text", required: true, max: 60, placeholder: "e.g. Simba" },
      { name: "species", label: "Species", type: "select", required: true, options: SPECIES },
      { name: "breed", label: "Breed", type: "text", max: 60, placeholder: "e.g. Boerboel" },
      { name: "sex", label: "Sex", type: "select", options: ["female", "male"] },
      { name: "birth_date", label: "Date of birth", type: "date" },
      { name: "weight_kg", label: "Weight (kg)", type: "number", max: 2000 },
      notes,
      { name: "photo_url", label: "Photo", type: "text", internal: true },
    ],
  },
  health_records: {
    orderBy: "record_date",
    fields: [
      pet,
      { name: "title", label: "Title", type: "text", required: true, max: 120, placeholder: "e.g. Annual check-up" },
      { name: "kind", label: "Type", type: "select", required: true, options: RECORD_KINDS },
      { name: "record_date", label: "Date", type: "date", required: true },
      { name: "vet_name", label: "Vet / clinic", type: "text", max: 120 },
      notes,
    ],
  },
  appointments: {
    orderBy: "scheduled_at",
    fields: [
      pet,
      { name: "title", label: "Reason", type: "text", required: true, max: 120, placeholder: "e.g. Rabies booster" },
      { name: "scheduled_at", label: "Date & time", type: "datetime", required: true },
      { name: "clinic", label: "Clinic / vet", type: "text", max: 120 },
      notes,
      { name: "status", label: "Status", type: "select", options: APPOINTMENT_STATUSES, internal: true },
    ],
  },
  treatments: {
    orderBy: "given_on",
    fields: [
      pet,
      { name: "type", label: "Type", type: "select", required: true, options: TREATMENT_TYPES },
      { name: "name", label: "Name", type: "text", required: true, max: 120, placeholder: "e.g. Rabies vaccine" },
      { name: "dose", label: "Dose", type: "text", max: 80, placeholder: "e.g. 1 ml, or 1 tablet twice daily" },
      { name: "given_on", label: "Given / started on", type: "date", required: true },
      { name: "next_due_on", label: "Next due", type: "date" },
      notes,
    ],
  },
  attachments: {
    orderBy: "created_at",
    fields: [
      pet,
      { name: "file_name", label: "File name", type: "text", required: true, max: 200 },
      { name: "content_type", label: "Content type", type: "text", required: true, max: 100 },
      { name: "size_bytes", label: "Size", type: "number", required: true },
      { name: "storage", label: "Storage", type: "text", required: true, max: 20 },
      { name: "storage_key", label: "Storage key", type: "text", required: true, max: 500 },
    ],
  },
} as const satisfies Record<string, { orderBy: string; fields: readonly Field[] }>;

export type TableName = keyof typeof TABLES;
export const isTableName = (v: string): v is TableName => Object.hasOwn(TABLES, v);
export const fieldsOf = (table: TableName): readonly Field[] => TABLES[table].fields;
export const formFieldsOf = (table: TableName) => fieldsOf(table).filter((f) => !f.internal);

interface Base {
  id: string;
  owner_id: string;
  created_at: string;
}
export interface Pet extends Base {
  name: string;
  species: (typeof SPECIES)[number];
  breed: string | null;
  sex: string | null;
  birth_date: string | null;
  weight_kg: number | null;
  notes: string | null;
  photo_url: string | null;
}
export interface HealthRecord extends Base {
  pet_id: string;
  title: string;
  kind: string;
  record_date: string;
  vet_name: string | null;
  notes: string | null;
}
export interface Appointment extends Base {
  pet_id: string;
  title: string;
  scheduled_at: string;
  clinic: string | null;
  notes: string | null;
  status: (typeof APPOINTMENT_STATUSES)[number];
}
export interface Treatment extends Base {
  pet_id: string;
  type: (typeof TREATMENT_TYPES)[number];
  name: string;
  dose: string | null;
  given_on: string;
  next_due_on: string | null;
  notes: string | null;
}
export interface Attachment extends Base {
  pet_id: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  storage: "blob" | "memory";
  storage_key: string;
}
export interface RowOf {
  pets: Pet;
  health_records: HealthRecord;
  appointments: Appointment;
  treatments: Treatment;
  attachments: Attachment;
}
export type Values = Record<string, string | number | null>;
