import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

/** Reports which integrations are switched on (true/false only — never any values). */
export function GET() {
  const c = getConfig();
  return NextResponse.json({
    ok: !c.unsafe,
    mode: c.demo ? "demo" : "live",
    integrations: {
      clerk: c.clerk,
      clerkWebhook: c.clerkWebhook,
      database: c.database,
      fileStorage: c.blob,
      email: c.email,
    },
  });
}
