// Applies db/schema.sql to the Neon database in DATABASE_URL.
// Usage: DATABASE_URL=... npm run db:migrate   (or put it in .env.local)
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.join(root, ".env.local");
if (!process.env.DATABASE_URL && existsSync(envFile)) process.loadEnvFile(envFile);

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Nothing was changed.");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const statements = readFileSync(path.join(root, "db/schema.sql"), "utf8")
  .replace(/--.*$/gm, "")
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

for (const statement of statements) {
  await sql.query(statement);
  console.log("ok:", statement.split("\n")[0].slice(0, 70));
}
console.log(`Applied ${statements.length} statements.`);
