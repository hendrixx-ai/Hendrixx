import { randomUUID } from "node:crypto";
import { TABLES, fieldsOf, type RowOf, type TableName, type Values } from "./schema";
import { isUuid } from "./validation";

export interface ListOptions {
  where?: Record<string, string>;
  desc?: boolean;
}
export interface WelcomeUser {
  id: string;
  email: string | null;
  name: string | null;
}

/**
 * Storage-agnostic data access. Every call is scoped to an owner id, so one
 * user can never read or change another user's rows.
 */
export interface Repo {
  list<T extends TableName>(table: T, ownerId: string, opts?: ListOptions): Promise<RowOf[T][]>;
  get<T extends TableName>(table: T, ownerId: string, id: string): Promise<RowOf[T] | null>;
  insert<T extends TableName>(table: T, ownerId: string, values: Values): Promise<RowOf[T]>;
  update<T extends TableName>(table: T, ownerId: string, id: string, values: Values): Promise<RowOf[T] | null>;
  remove(table: TableName, ownerId: string, id: string): Promise<boolean>;
  /** Records the user and returns true only the first time, so the welcome email is sent once. */
  claimWelcome(user: WelcomeUser): Promise<boolean>;
  /** Undo a claim when sending failed, so a retry can send it. */
  releaseWelcome(userId: string): Promise<void>;
}

const fieldNames = (table: TableName) => fieldsOf(table).map((f) => f.name);

function pick(table: TableName, values: Values): Values {
  const out: Values = {};
  for (const name of fieldNames(table)) if (name in values) out[name] = values[name];
  return out;
}

/* ---------------------------------------------------------------- memory */

type AnyRow = Record<string, unknown> & { id: string; owner_id: string; created_at: string };

export class MemoryRepo implements Repo {
  private tables = new Map<TableName, AnyRow[]>();
  private welcomed = new Set<string>();

  private rows(table: TableName) {
    if (!this.tables.has(table)) this.tables.set(table, []);
    return this.tables.get(table)!;
  }

  async list<T extends TableName>(table: T, ownerId: string, opts: ListOptions = {}) {
    const key = TABLES[table].orderBy;
    const dir = opts.desc ? -1 : 1;
    const where = Object.entries(opts.where ?? {});
    return this.rows(table)
      .filter((r) => r.owner_id === ownerId && where.every(([k, v]) => r[k] === v))
      .sort((a, b) => dir * String(a[key] ?? "").localeCompare(String(b[key] ?? "")) || a.id.localeCompare(b.id))
      .map((r) => ({ ...r })) as unknown as RowOf[T][];
  }

  async get<T extends TableName>(table: T, ownerId: string, id: string) {
    const row = this.rows(table).find((r) => r.id === id && r.owner_id === ownerId);
    return row ? ({ ...row } as unknown as RowOf[T]) : null;
  }

  async insert<T extends TableName>(table: T, ownerId: string, values: Values) {
    const blank = Object.fromEntries(fieldNames(table).map((n) => [n, null]));
    const row: AnyRow = {
      ...blank,
      ...pick(table, values),
      id: randomUUID(),
      owner_id: ownerId,
      created_at: new Date().toISOString(),
    };
    this.rows(table).push(row);
    return { ...row } as unknown as RowOf[T];
  }

  async update<T extends TableName>(table: T, ownerId: string, id: string, values: Values) {
    const row = this.rows(table).find((r) => r.id === id && r.owner_id === ownerId);
    if (!row) return null;
    Object.assign(row, pick(table, values));
    return { ...row } as unknown as RowOf[T];
  }

  async remove(table: TableName, ownerId: string, id: string) {
    const rows = this.rows(table);
    const i = rows.findIndex((r) => r.id === id && r.owner_id === ownerId);
    if (i < 0) return false;
    rows.splice(i, 1);
    if (table === "pets") {
      // Mirrors "on delete cascade" in db/schema.sql.
      for (const [name, list] of this.tables) {
        if (name !== "pets") this.tables.set(name, list.filter((r) => r.pet_id !== id));
      }
    }
    return true;
  }

  async claimWelcome(user: WelcomeUser) {
    if (this.welcomed.has(user.id)) return false;
    this.welcomed.add(user.id);
    return true;
  }

  async releaseWelcome(userId: string) {
    this.welcomed.delete(userId);
  }
}

/* ------------------------------------------------------------------- sql */

export type SqlExec = (text: string, params: unknown[]) => Promise<Record<string, unknown>[]>;

function selectList(table: TableName): string {
  const cols = fieldsOf(table).map((f) => {
    if (f.type === "date") return `to_char(${f.name}, 'YYYY-MM-DD') as ${f.name}`;
    if (f.type === "datetime") return `to_char(${f.name}, 'YYYY-MM-DD"T"HH24:MI') as ${f.name}`;
    if (f.type === "number") return `${f.name}::float8 as ${f.name}`;
    return f.name;
  });
  const created = `to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at`;
  return ["id", "owner_id", ...cols, created].join(", ");
}

/**
 * Postgres driver. Table and column names only ever come from src/lib/schema.ts
 * (never from user input); all values travel as bound parameters.
 */
export class SqlRepo implements Repo {
  constructor(private exec: SqlExec) {}

  async list<T extends TableName>(table: T, ownerId: string, opts: ListOptions = {}) {
    const allowed = new Set(fieldNames(table));
    const params: unknown[] = [ownerId];
    const conditions = ["owner_id = $1"];
    for (const [k, v] of Object.entries(opts.where ?? {})) {
      if (!allowed.has(k)) throw new Error(`Unknown column ${k}`);
      params.push(v);
      conditions.push(`${k} = $${params.length}`);
    }
    const dir = opts.desc ? "desc" : "asc";
    const rows = await this.exec(
      `select ${selectList(table)} from ${table} where ${conditions.join(" and ")} ` +
        `order by ${TABLES[table].orderBy} ${dir} nulls last, id ${dir}`,
      params,
    );
    return rows as unknown as RowOf[T][];
  }

  async get<T extends TableName>(table: T, ownerId: string, id: string) {
    if (!isUuid(id)) return null;
    const rows = await this.exec(
      `select ${selectList(table)} from ${table} where id = $1 and owner_id = $2`,
      [id, ownerId],
    );
    return (rows[0] as unknown as RowOf[T]) ?? null;
  }

  async insert<T extends TableName>(table: T, ownerId: string, values: Values) {
    const data = pick(table, values);
    const cols = ["id", "owner_id", ...Object.keys(data)];
    const params = [randomUUID(), ownerId, ...Object.values(data)];
    const rows = await this.exec(
      `insert into ${table} (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) ` +
        `returning ${selectList(table)}`,
      params,
    );
    return rows[0] as unknown as RowOf[T];
  }

  async update<T extends TableName>(table: T, ownerId: string, id: string, values: Values) {
    const data = pick(table, values);
    const keys = Object.keys(data);
    if (!isUuid(id)) return null;
    if (!keys.length) return this.get(table, ownerId, id);
    const rows = await this.exec(
      `update ${table} set ${keys.map((k, i) => `${k} = $${i + 3}`).join(", ")} ` +
        `where id = $1 and owner_id = $2 returning ${selectList(table)}`,
      [id, ownerId, ...Object.values(data)],
    );
    return (rows[0] as unknown as RowOf[T]) ?? null;
  }

  async remove(table: TableName, ownerId: string, id: string) {
    if (!isUuid(id)) return false;
    const rows = await this.exec(`delete from ${table} where id = $1 and owner_id = $2 returning id`, [id, ownerId]);
    return rows.length > 0;
  }

  async claimWelcome(user: WelcomeUser) {
    await this.exec(
      `insert into users (id, email, name) values ($1, $2, $3)
       on conflict (id) do update set email = excluded.email, name = excluded.name`,
      [user.id, user.email, user.name],
    );
    const rows = await this.exec(
      `update users set welcome_email_sent_at = now()
       where id = $1 and welcome_email_sent_at is null returning id`,
      [user.id],
    );
    return rows.length > 0;
  }

  async releaseWelcome(userId: string) {
    await this.exec(`update users set welcome_email_sent_at = null where id = $1`, [userId]);
  }
}
