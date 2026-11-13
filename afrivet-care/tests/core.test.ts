import { describe, expect, it } from "vitest";
import { getConfig } from "@/lib/config";
import { addDays, ageLabel, dueLabel, dueStatus, formatDateTime, nowLocal } from "@/lib/dates";
import { buildWelcomeEmail, sendWelcomeEmail } from "@/lib/email";
import { dueTreatments, missedAppointments, upcomingAppointments } from "@/lib/insights";
import type { Appointment, Treatment } from "@/lib/schema";
import { matchesSignature, MAX_UPLOAD_BYTES, safeFileName, validateUpload } from "@/lib/storage";
import { validate } from "@/lib/validation";

const PET = "3f2b8c1e-9d4a-4b6f-8a1c-2e5d7f9b0a11";

describe("config", () => {
  it("runs in demo mode with nothing set", () => {
    const c = getConfig({});
    expect(c).toMatchObject({ demo: true, clerk: false, database: false, blob: false, email: false, unsafe: false });
    expect(c.timezone).toBe("Africa/Dar_es_Salaam");
  });
  it("needs both Clerk keys, and both Resend values", () => {
    expect(getConfig({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk" }).clerk).toBe(false);
    expect(getConfig({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk", CLERK_SECRET_KEY: "sk" }).clerk).toBe(true);
    expect(getConfig({ RESEND_API_KEY: "re" }).email).toBe(false);
    expect(getConfig({ RESEND_API_KEY: " " }).email).toBe(false);
  });
  it("flags a production database without sign-in as unsafe", () => {
    expect(getConfig({ DATABASE_URL: "x", NODE_ENV: "production" }).unsafe).toBe(true);
    expect(getConfig({ DATABASE_URL: "x", NODE_ENV: "development" }).unsafe).toBe(false);
    const full = { DATABASE_URL: "x", NODE_ENV: "production", NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk", CLERK_SECRET_KEY: "sk" };
    expect(getConfig(full)).toMatchObject({ unsafe: false, demo: false });
  });
});

describe("validation", () => {
  it("accepts a good pet and normalises blanks to null", () => {
    const r = validate("pets", { name: "  Simba ", species: "dog", breed: "", weight_kg: "58.5" });
    expect(r).toEqual({
      ok: true,
      values: { name: "Simba", species: "dog", breed: null, sex: null, birth_date: null, weight_kg: 58.5, notes: null },
    });
  });
  it("reports every problem at once", () => {
    const r = validate("pets", { name: "", species: "dragon", birth_date: "2026-02-30", weight_kg: "-3" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["birth_date", "name", "species", "weight_kg"]);
  });
  it("ignores fields users may not set", () => {
    const r = validate("pets", { name: "A", species: "cat", photo_url: "https://evil.example/x", owner_id: "other" });
    expect(r.ok && "photo_url" in r.values).toBe(false);
    expect(r.ok && "owner_id" in r.values).toBe(false);
    const a = validate("appointments", { pet_id: PET, title: "x", scheduled_at: "2026-11-20T09:30", status: "completed" });
    expect(a.ok && "status" in a.values).toBe(false);
  });
  it("checks pet ids, dates, times and lengths", () => {
    expect(validate("appointments", { pet_id: "1; drop table pets", title: "x", scheduled_at: "2026-11-20T09:30" }).ok).toBe(false);
    expect(validate("appointments", { pet_id: PET, title: "x", scheduled_at: "2026-11-20T25:00" }).ok).toBe(false);
    expect(validate("appointments", { pet_id: PET, title: "x", scheduled_at: "2026-11-20T09:30:15" })).toMatchObject({
      ok: true,
      values: { scheduled_at: "2026-11-20T09:30" },
    });
    expect(validate("health_records", { pet_id: PET, title: "x".repeat(121), kind: "checkup", record_date: "2026-01-01" }).ok).toBe(false);
  });
  it("validates only the given fields in partial mode", () => {
    expect(validate("appointments", { status: "completed" }, { partial: true, includeInternal: true })).toEqual({
      ok: true,
      values: { status: "completed" },
    });
    expect(validate("appointments", { status: "exploded" }, { partial: true, includeInternal: true }).ok).toBe(false);
  });
});

describe("dates", () => {
  it("computes clinic-local now across the UTC date line", () => {
    const at = new Date("2026-11-13T22:30:00Z");
    expect(nowLocal("Africa/Dar_es_Salaam", at)).toBe("2026-11-14T01:30");
    expect(nowLocal("UTC", at)).toBe("2026-11-13T22:30");
    expect(nowLocal("Africa/Dar_es_Salaam", new Date("2026-11-13T21:00:00Z"))).toBe("2026-11-14T00:00");
  });
  it("adds days across month and leap-year edges", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("labels ages", () => {
    expect(ageLabel("2026-11-01", "2026-11-13")).toBe("12 days");
    expect(ageLabel("2026-01-14", "2026-11-13")).toBe("9 mo");
    expect(ageLabel("2023-11-14", "2026-11-13")).toBe("2 yr");
    expect(ageLabel("2023-11-13", "2026-11-13")).toBe("3 yr");
    expect(ageLabel("2027-01-01", "2026-11-13")).toBeNull();
    expect(ageLabel(null, "2026-11-13")).toBeNull();
  });
  it("classifies due dates at the boundaries", () => {
    const today = "2026-11-13";
    expect(dueStatus(null, today)).toBe("none");
    expect(dueStatus("2026-11-12", today)).toBe("overdue");
    expect(dueStatus(today, today)).toBe("soon");
    expect(dueStatus("2026-12-13", today)).toBe("soon");
    expect(dueStatus("2026-12-14", today)).toBe("later");
    expect(dueLabel(today, today)).toBe("Due today");
    expect(dueLabel("2026-11-14", today)).toBe("Due tomorrow");
    expect(dueLabel("2026-11-12", today)).toBe("1 day overdue");
    expect(dueLabel("2026-11-06", today)).toBe("7 days overdue");
    expect(dueLabel("2026-11-25", today)).toBe("Due in 12 days");
  });
  it("formats appointment times as entered", () => {
    expect(formatDateTime("2026-11-20T09:30")).toBe("Fri 20 Nov, 09:30");
  });
});

describe("insights", () => {
  const t = (over: Partial<Treatment>): Treatment => ({
    id: Math.random().toString(), owner_id: "u", created_at: "", pet_id: "p1", type: "vaccination", name: "Rabies",
    dose: null, given_on: "2025-11-01", next_due_on: null, notes: null, ...over,
  });
  it("a newer dose clears the reminder from the older one", () => {
    const today = "2026-11-13";
    const old = t({ given_on: "2025-11-01", next_due_on: "2026-11-01" });
    expect(dueTreatments([old], today).map((d) => d.status)).toEqual(["overdue"]);
    const booster = t({ name: " rabies ", given_on: "2026-11-10", next_due_on: "2027-11-10" });
    expect(dueTreatments([old, booster], today)).toEqual([]);
    // ...but not for a different pet or a different treatment.
    expect(dueTreatments([old, t({ pet_id: "p2", given_on: "2026-11-10" })], today)).toHaveLength(1);
    expect(dueTreatments([old, t({ name: "Parvo", given_on: "2026-11-10" })], today)).toHaveLength(1);
  });
  it("sorts most urgent first and skips far-off dates", () => {
    const today = "2026-11-13";
    const due = dueTreatments(
      [
        t({ name: "A", next_due_on: "2026-12-01" }),
        t({ name: "B", next_due_on: "2026-10-01" }),
        t({ name: "C", next_due_on: "2027-06-01" }),
      ],
      today,
    );
    expect(due.map((d) => [d.treatment.name, d.status])).toEqual([["B", "overdue"], ["A", "soon"]]);
  });
  it("splits appointments into upcoming and missed", () => {
    const a = (scheduled_at: string, status: Appointment["status"] = "scheduled"): Appointment => ({
      id: scheduled_at + status, owner_id: "u", created_at: "", pet_id: "p", title: "x", clinic: null, notes: null,
      scheduled_at, status,
    });
    const list = [a("2026-11-20T09:00"), a("2026-11-13T10:00"), a("2026-11-13T09:59"), a("2026-11-25T09:00", "cancelled")];
    const now = "2026-11-13T10:00";
    expect(upcomingAppointments(list, now).map((x) => x.scheduled_at)).toEqual(["2026-11-13T10:00", "2026-11-20T09:00"]);
    expect(missedAppointments(list, now).map((x) => x.scheduled_at)).toEqual(["2026-11-13T09:59"]);
  });
});

describe("uploads", () => {
  it("accepts allowed types within the size limit only", () => {
    expect(validateUpload({ name: "a.png", type: "image/png", size: 1000 })).toBeNull();
    expect(validateUpload({ name: "a.pdf", type: "application/pdf", size: MAX_UPLOAD_BYTES })).toBeNull();
    expect(validateUpload({ name: "a.pdf", type: "application/pdf", size: MAX_UPLOAD_BYTES + 1 })).toMatch(/4 MB/);
    expect(validateUpload({ name: "a.svg", type: "image/svg+xml", size: 10 })).toMatch(/Only/);
    expect(validateUpload({ name: "a.html", type: "text/html", size: 10 })).toMatch(/Only/);
    expect(validateUpload({ name: "a.png", type: "image/png", size: 0 })).toMatch(/Choose/);
    expect(validateUpload(null)).toMatch(/Choose/);
  });
  it("checks file contents, not just the declared type", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    const html = new TextEncoder().encode("<script>alert(1)</script>");
    expect(matchesSignature("image/png", png)).toBe(true);
    expect(matchesSignature("image/png", html)).toBe(false);
    expect(matchesSignature("image/jpeg", png)).toBe(false);
    expect(matchesSignature("application/pdf", new TextEncoder().encode("%PDF-1.7"))).toBe(true);
    expect(matchesSignature("image/webp", new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe(true);
    expect(matchesSignature("text/html", html)).toBe(false);
  });
  it("cleans file names", () => {
    expect(safeFileName("../../etc/pass wd.png")).toBe("....etcpass wd.png");
    expect(safeFileName('x"><img src=x>.pdf')).toBe("ximg srcx.pdf");
    expect(safeFileName("///")).toBe("file");
  });
});

describe("welcome email", () => {
  const input = { userId: "user_1", to: "amina@example.com", name: "Amina <b>" };
  it("does nothing without Resend settings", async () => {
    let called = false;
    const fake = (async () => ((called = true), new Response("{}"))) as typeof fetch;
    expect(await sendWelcomeEmail(input, {}, fake)).toEqual({ sent: false, reason: "not_configured" });
    expect(called).toBe(false);
  });
  it("posts the right request to Resend", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fake = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ id: "em_1" }), { status: 200 });
    }) as typeof fetch;
    const env = { RESEND_API_KEY: "re_test", EMAIL_FROM: "AFRIVet <hi@afrivet.example>", NEXT_PUBLIC_APP_URL: "https://afrivet.example/" };
    expect(await sendWelcomeEmail(input, env, fake)).toEqual({ sent: true, id: "em_1" });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.resend.com/emails");
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer re_test");
    expect(headers["Idempotency-Key"]).toBe("welcome/user_1");
    const body = JSON.parse(String(calls[0].init.body));
    expect(body).toMatchObject({ from: env.EMAIL_FROM, to: ["amina@example.com"], subject: "Welcome to AFRIVet Care" });
    expect(body.html).toContain("Amina &lt;b&gt;");
    expect(body.html).not.toContain("<b>");
    expect(body.html).toContain('href="https://afrivet.example"');
    expect(body.text).toContain("Hi Amina <b>,");
  });
  it("reports failures instead of throwing", async () => {
    const env = { RESEND_API_KEY: "re_test", EMAIL_FROM: "a@b.c" };
    const bad = (async () => new Response("nope", { status: 422 })) as typeof fetch;
    expect(await sendWelcomeEmail(input, env, bad)).toMatchObject({ sent: false, reason: "failed" });
    const down = (async () => { throw new Error("offline"); }) as typeof fetch;
    expect(await sendWelcomeEmail(input, env, down)).toEqual({ sent: false, reason: "failed", detail: "offline" });
  });
  it("omits the button when no app URL is known", () => {
    const mail = buildWelcomeEmail({ userId: "u", to: "a@b.c" }, "");
    expect(mail.html).not.toContain("<a ");
    expect(mail.text).toContain("Hi there,");
  });
});
