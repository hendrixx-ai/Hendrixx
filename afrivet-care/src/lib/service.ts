import type { Repo } from "./repo";
import type { FileStore } from "./storage";
import { fieldsOf, type RowOf, type TableName } from "./schema";
import { isUuid, validate } from "./validation";

export type Result<T> = { ok: true; row: T } | { ok: false; errors: Record<string, string> };

const hasPet = (table: TableName) => fieldsOf(table).some((f) => f.name === "pet_id");

/** Business rules shared by server actions and API routes. */
export function createService(repo: Repo, files: FileStore, ownerId: string) {
  async function create<T extends TableName>(
    table: T,
    input: Record<string, unknown>,
    opts: { includeInternal?: boolean } = {},
  ): Promise<Result<RowOf[T]>> {
    const res = validate(table, input, opts);
    if (!res.ok) return res;
    const values = { ...res.values };
    if (hasPet(table)) {
      // A record may only be attached to an animal the user owns.
      const pet = await repo.get("pets", ownerId, String(values.pet_id));
      if (!pet) return { ok: false, errors: { pet_id: "Choose one of your pets" } };
    }
    if (table === "appointments") values.status = values.status ?? "scheduled";
    if (table === "treatments" && values.next_due_on && values.next_due_on < values.given_on!) {
      return { ok: false, errors: { next_due_on: "Next due date must be after the date given" } };
    }
    return { ok: true, row: await repo.insert(table, ownerId, values) };
  }

  async function update<T extends TableName>(
    table: T,
    id: string,
    input: Record<string, unknown>,
  ): Promise<Result<RowOf[T]>> {
    const res = validate(table, input, { includeInternal: true, partial: true });
    if (!res.ok) return res;
    if ("pet_id" in res.values) return { ok: false, errors: { pet_id: "A record cannot be moved to another pet" } };
    const row = isUuid(id) ? await repo.update(table, ownerId, id, res.values) : null;
    return row ? { ok: true, row } : { ok: false, errors: { _: "Not found" } };
  }

  async function remove(table: TableName, id: string): Promise<boolean> {
    if (!isUuid(id)) return false;
    const attachments =
      table === "pets"
        ? await repo.list("attachments", ownerId, { where: { pet_id: id } })
        : table === "attachments"
          ? [await repo.get("attachments", ownerId, id)].filter((a) => a !== null)
          : [];
    const removed = await repo.remove(table, ownerId, id);
    if (!removed) return false;
    for (const a of attachments) {
      // The row is already gone; a storage hiccup must not fail the delete.
      await files.remove(a.storage_key).catch(() => undefined);
      if (table === "attachments") {
        const pet = await repo.get("pets", ownerId, a.pet_id);
        if (pet?.photo_url === `/api/files/${a.id}`) await repo.update("pets", ownerId, pet.id, { photo_url: null });
      }
    }
    return true;
  }

  return { create, update, remove };
}
