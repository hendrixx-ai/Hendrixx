import "server-only";
import { redirect } from "next/navigation";
import { getConfig } from "./config";
import { MemoryRepo, SqlRepo, type Repo } from "./repo";
import { BlobFileStore, MemoryFileStore, type FileStore } from "./storage";
import { createService } from "./service";
import { seedDemo } from "./seed";
import { todayLocal } from "./dates";

export const DEMO_USER_ID = "demo-user";

// Kept on globalThis so the demo data survives hot reloads in development.
const g = globalThis as unknown as {
  __afrivet?: { repo: MemoryRepo; files: MemoryFileStore; seeded?: Promise<void> };
};

function memory() {
  g.__afrivet ??= { repo: new MemoryRepo(), files: new MemoryFileStore() };
  return g.__afrivet;
}

let sqlRepo: SqlRepo | undefined;

export async function getRepo(): Promise<Repo> {
  const config = getConfig();
  if (config.database) {
    if (!sqlRepo) {
      const { neon } = await import("@neondatabase/serverless");
      const sql = neon(process.env.DATABASE_URL!);
      sqlRepo = new SqlRepo((text, params) => sql.query(text, params) as Promise<Record<string, unknown>[]>);
    }
    return sqlRepo;
  }
  const mem = memory();
  mem.seeded ??= seedDemo(mem.repo, DEMO_USER_ID, todayLocal(config.timezone));
  await mem.seeded;
  return mem.repo;
}

export function getFileStore(kind?: "blob" | "memory"): FileStore {
  const useBlob = kind ? kind === "blob" : getConfig().blob;
  return useBlob ? new BlobFileStore() : memory().files;
}

export class ConfigError extends Error {}

/** The current user's id, or null when signed out. */
export async function getOwnerId(): Promise<string | null> {
  const config = getConfig();
  if (config.clerk) {
    const { auth } = await import("@clerk/nextjs/server");
    return (await auth()).userId;
  }
  if (config.unsafe) {
    throw new ConfigError(
      "DATABASE_URL is set but Clerk is not. Add the Clerk keys so records are private to each user.",
    );
  }
  return DEMO_USER_ID;
}

/** For pages and server actions: sends signed-out visitors to the sign-in page. */
export async function requireOwnerId(): Promise<string> {
  const id = await getOwnerId();
  if (!id) redirect("/sign-in");
  return id;
}

export async function getContext() {
  const ownerId = await requireOwnerId();
  const repo = await getRepo();
  const config = getConfig();
  return {
    ownerId,
    repo,
    config,
    today: todayLocal(config.timezone),
    service: createService(repo, getFileStore(), ownerId),
  };
}
