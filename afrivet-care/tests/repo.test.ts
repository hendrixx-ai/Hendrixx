import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { MemoryRepo, SqlRepo, type Repo } from "@/lib/repo";
import { seedDemo } from "@/lib/seed";
import { createService } from "@/lib/service";
import { MemoryFileStore } from "@/lib/storage";

/**
 * The same behaviour is required of the demo store and of the Postgres driver.
 * The Postgres driver runs against PGlite (real Postgres compiled to WASM) using
 * db/schema.sql, so the schema file and every generated query are exercised.
 */
const drivers: [string, () => Promise<Repo>][] = [
  ["memory", async () => new MemoryRepo()],
  [
    "postgres",
    async () => {
      const db = new PGlite();
      const schema = readFileSync(path.resolve(__dirname, "../db/schema.sql"), "utf8");
      await db.exec(schema);
      await db.exec(schema); // must be safe to apply twice
      return new SqlRepo(async (text, params) => (await db.query(text, params)).rows as Record<string, unknown>[]);
    },
  ],
];

describe.each(drivers)("%s repo", (_name, make) => {
  let repo: Repo;
  const files = new MemoryFileStore();
  const amina = () => createService(repo, files, "user_amina");
  const baraka = () => createService(repo, files, "user_baraka");
  let petId: string;

  beforeAll(async () => {
    repo = await make();
  });

  it("creates and reads back a pet with the exact same values", async () => {
    const res = await amina().create("pets", {
      name: "Simba", species: "dog", breed: "Boerboel", birth_date: "2023-06-11", weight_kg: "58.25", notes: "O'Brien; -- \"x\"",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    petId = res.row.id;
    const pet = await repo.get("pets", "user_amina", petId);
    expect(pet).toMatchObject({
      id: petId, owner_id: "user_amina", name: "Simba", species: "dog", breed: "Boerboel", sex: null,
      birth_date: "2023-06-11", weight_kg: 58.25, notes: "O'Brien; -- \"x\"", photo_url: null,
    });
    expect(pet!.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("rejects invalid input without writing anything", async () => {
    const res = await amina().create("pets", { name: "", species: "dog" });
    expect(res).toEqual({ ok: false, errors: { name: "Name is required" } });
    expect(await repo.list("pets", "user_amina")).toHaveLength(1);
  });

  it("round-trips dates and wall-clock appointment times unchanged", async () => {
    const s = amina();
    const appt = await s.create("appointments", { pet_id: petId, title: "Booster", scheduled_at: "2026-11-20T09:30", clinic: "Arusha Vet" });
    const shot = await s.create("treatments", { pet_id: petId, type: "vaccination", name: "Rabies", given_on: "2026-11-13", next_due_on: "2027-11-13" });
    const rec = await s.create("health_records", { pet_id: petId, title: "Check-up", kind: "checkup", record_date: "2026-11-01" });
    expect(appt).toMatchObject({ ok: true, row: { scheduled_at: "2026-11-20T09:30", status: "scheduled", notes: null } });
    expect(shot).toMatchObject({ ok: true, row: { given_on: "2026-11-13", next_due_on: "2027-11-13", dose: null } });
    expect(rec).toMatchObject({ ok: true, row: { record_date: "2026-11-01" } });
    const listed = await repo.list("appointments", "user_amina", { where: { pet_id: petId } });
    expect(listed.map((a) => a.scheduled_at)).toEqual(["2026-11-20T09:30"]);
  });

  it("rejects a next-due date before the given date", async () => {
    const res = await amina().create("treatments", { pet_id: petId, type: "medication", name: "X", given_on: "2026-11-13", next_due_on: "2026-11-01" });
    expect(res.ok).toBe(false);
  });

  it("orders lists and filters by pet", async () => {
    const s = amina();
    const other = await s.create("pets", { name: "Bahati", species: "goat" });
    if (!other.ok) throw new Error("setup");
    await s.create("health_records", { pet_id: petId, title: "Older", kind: "illness", record_date: "2025-01-05" });
    await s.create("health_records", { pet_id: other.row.id, title: "Goat", kind: "injury", record_date: "2026-06-01" });
    expect((await repo.list("pets", "user_amina")).map((p) => p.name)).toEqual(["Bahati", "Simba"]);
    expect((await repo.list("health_records", "user_amina", { desc: true })).map((r) => r.title)).toEqual(["Check-up", "Goat", "Older"]);
    expect((await repo.list("health_records", "user_amina")).map((r) => r.title)).toEqual(["Older", "Goat", "Check-up"]);
    expect((await repo.list("health_records", "user_amina", { where: { pet_id: other.row.id } })).map((r) => r.title)).toEqual(["Goat"]);
  });

  it("keeps each user's data private", async () => {
    expect(await repo.get("pets", "user_baraka", petId)).toBeNull();
    expect(await repo.list("pets", "user_baraka")).toEqual([]);
    expect(await repo.list("health_records", "user_baraka")).toEqual([]);
    // Cannot attach a record to someone else's pet...
    const sneaky = await baraka().create("health_records", { pet_id: petId, title: "Hack", kind: "other", record_date: "2026-01-01" });
    expect(sneaky).toEqual({ ok: false, errors: { pet_id: "Choose one of your pets" } });
    // ...nor change or delete their rows.
    expect((await baraka().update("pets", petId, { name: "Stolen" })).ok).toBe(false);
    expect(await baraka().remove("pets", petId)).toBe(false);
    expect((await repo.get("pets", "user_amina", petId))?.name).toBe("Simba");
    expect((await repo.list("health_records", "user_amina")).some((r) => r.title === "Hack")).toBe(false);
  });

  it("handles malformed ids safely", async () => {
    expect(await repo.get("pets", "user_amina", "not-a-uuid")).toBeNull();
    expect(await amina().remove("pets", "' or 1=1 --")).toBe(false);
    expect((await amina().update("pets", "nope", { name: "x" })).ok).toBe(false);
    expect(await repo.list("pets", "user_amina")).toHaveLength(2);
  });

  it("updates only the fields given", async () => {
    const res = await amina().update("pets", petId, { weight_kg: "60", breed: "" });
    expect(res).toMatchObject({ ok: true, row: { name: "Simba", weight_kg: 60, breed: null, birth_date: "2023-06-11" } });
    const [appt] = await repo.list("appointments", "user_amina");
    const done = await amina().update("appointments", appt.id, { status: "completed" });
    expect(done).toMatchObject({ ok: true, row: { status: "completed", title: "Booster", scheduled_at: "2026-11-20T09:30" } });
    expect((await amina().update("appointments", appt.id, { status: "bogus" })).ok).toBe(false);
    expect((await amina().update("appointments", appt.id, { pet_id: petId })).ok).toBe(false);
  });

  it("stores attachments, clears the photo and removes the file on delete", async () => {
    const stored = await files.put("user_amina/a.png", new Uint8Array([1, 2, 3]), "image/png");
    const att = await amina().create("attachments", { pet_id: petId, file_name: "a.png", content_type: "image/png", size_bytes: 3, ...stored });
    if (!att.ok) throw new Error(JSON.stringify(att.errors));
    expect(att.row).toMatchObject({ size_bytes: 3, storage: "memory", storage_key: "user_amina/a.png" });
    await repo.update("pets", "user_amina", petId, { photo_url: `/api/files/${att.row.id}` });
    expect(await repo.get("attachments", "user_baraka", att.row.id)).toBeNull();

    expect(await amina().remove("attachments", att.row.id)).toBe(true);
    expect(await files.get("user_amina/a.png")).toBeNull();
    expect((await repo.get("pets", "user_amina", petId))?.photo_url).toBeNull();
  });

  it("deleting a pet removes its records, visits, treatments and files", async () => {
    const stored = await files.put("user_amina/b.pdf", new Uint8Array([9]), "application/pdf");
    await amina().create("attachments", { pet_id: petId, file_name: "b.pdf", content_type: "application/pdf", size_bytes: 1, ...stored });
    expect(await amina().remove("pets", petId)).toBe(true);
    expect(await repo.get("pets", "user_amina", petId)).toBeNull();
    for (const table of ["health_records", "appointments", "treatments", "attachments"] as const) {
      expect(await repo.list(table, "user_amina", { where: { pet_id: petId } })).toEqual([]);
    }
    expect(await files.get("user_amina/b.pdf")).toBeNull();
    // The other pet and its record are untouched.
    expect((await repo.list("pets", "user_amina")).map((p) => p.name)).toEqual(["Bahati"]);
    expect((await repo.list("health_records", "user_amina")).map((r) => r.title)).toEqual(["Goat"]);
  });

  it("claims the welcome email once, and again after a release", async () => {
    const user = { id: "user_new", email: "new@example.com", name: "New User" };
    expect(await repo.claimWelcome(user)).toBe(true);
    expect(await repo.claimWelcome(user)).toBe(false);
    await repo.releaseWelcome(user.id);
    expect(await repo.claimWelcome(user)).toBe(true);
    expect(await repo.claimWelcome(user)).toBe(false);
  });

  it("loads the demo seed", async () => {
    await seedDemo(repo, "seed_user", "2026-11-13");
    expect(await repo.list("pets", "seed_user")).toHaveLength(3);
    expect(await repo.list("treatments", "seed_user")).toHaveLength(5);
    expect(await repo.list("appointments", "seed_user")).toHaveLength(3);
  });
});
