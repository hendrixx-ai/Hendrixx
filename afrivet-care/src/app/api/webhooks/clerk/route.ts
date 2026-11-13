import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";
import { getConfig } from "@/lib/config";
import { sendWelcomeEmail } from "@/lib/email";
import { getRepo } from "@/lib/server";

/**
 * Clerk calls this when a user signs up (event: user.created).
 * Flow: verify signature → record the user → send the welcome email exactly once.
 * In Clerk: Configure → Webhooks → add endpoint https://<your-domain>/api/webhooks/clerk
 */
export async function POST(req: NextRequest) {
  if (!getConfig().clerkWebhook) return new Response("Webhook is not configured", { status: 503 });

  let event;
  try {
    event = await verifyWebhook(req); // uses CLERK_WEBHOOK_SIGNING_SECRET
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  if (event.type !== "user.created") return Response.json({ ignored: event.type });

  const user = event.data;
  const email =
    user.email_addresses.find((e) => e.id === user.primary_email_address_id)?.email_address ??
    user.email_addresses[0]?.email_address ??
    null;
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || null;

  const repo = await getRepo();
  const firstTime = await repo.claimWelcome({ id: user.id, email, name });
  if (!firstTime || !email) return Response.json({ sent: false, reason: firstTime ? "no_email" : "already_sent" });

  const result = await sendWelcomeEmail({ userId: user.id, to: email, name: user.first_name });
  if (!result.sent) {
    // Nothing was sent, so release the claim: a later attempt may still send it.
    await repo.releaseWelcome(user.id);
    if (result.reason === "failed") {
      console.error("Welcome email failed:", result.detail);
      return new Response("Email could not be sent", { status: 500 }); // Clerk retries on errors
    }
  }
  return Response.json(result);
}
