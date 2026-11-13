/**
 * Single place that decides which integrations are switched on.
 * Every integration is optional: with nothing configured the app runs in demo mode.
 */
type Env = Record<string, string | undefined>;

const has = (env: Env, ...keys: string[]) => keys.every((k) => !!env[k]?.trim());

export function getConfig(env: Env = process.env) {
  const clerk = has(env, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY");
  const database = has(env, "DATABASE_URL");
  return {
    clerk,
    clerkWebhook: has(env, "CLERK_WEBHOOK_SIGNING_SECRET"),
    database,
    blob: has(env, "BLOB_READ_WRITE_TOKEN"),
    email: has(env, "RESEND_API_KEY", "EMAIL_FROM"),
    /** No sign-in and no database: sample data held in memory. */
    demo: !clerk && !database,
    /**
     * A real database without sign-in would let every visitor read and edit the
     * same records, so that combination is refused outside local development.
     */
    unsafe: database && !clerk && env.NODE_ENV === "production",
    timezone: env.APP_TIMEZONE?.trim() || "Africa/Dar_es_Salaam",
    appUrl: (env.NEXT_PUBLIC_APP_URL?.trim() || "").replace(/\/$/, ""),
  };
}

export type AppConfig = ReturnType<typeof getConfig>;
