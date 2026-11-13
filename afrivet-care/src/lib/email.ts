/** Welcome email via the Resend HTTP API. Needs RESEND_API_KEY and EMAIL_FROM. */
export interface WelcomeInput {
  userId: string;
  to: string;
  name?: string | null;
}
export type SendResult =
  | { sent: true; id: string | null }
  | { sent: false; reason: "not_configured" | "failed"; detail?: string };

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function buildWelcomeEmail(input: WelcomeInput, appUrl: string) {
  const name = input.name?.trim() || "there";
  const link = appUrl || null;
  const lines = [
    `Hi ${name},`,
    "Welcome to AFRIVet Care. Your animals' health records now live in one place.",
    "To get started: add your first animal, record its vaccinations, and book its next visit.",
  ];
  const text = [...lines, link ? `Open AFRIVet Care: ${link}` : "", "— The AFRIVet Care team"]
    .filter(Boolean)
    .join("\n\n");
  const html =
    `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#1c2b22;line-height:1.55">` +
    `<h1 style="font-size:22px;color:#14532d">Welcome to AFRIVet Care</h1>` +
    lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("") +
    (link
      ? `<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#14532d;color:#fff;` +
        `padding:12px 20px;border-radius:10px;text-decoration:none">Open AFRIVet Care</a></p>`
      : "") +
    `<p style="color:#5b6b61">— The AFRIVet Care team</p></div>`;
  return { subject: "Welcome to AFRIVet Care", text, html };
}

export async function sendWelcomeEmail(
  input: WelcomeInput,
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<SendResult> {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.EMAIL_FROM?.trim();
  if (!apiKey || !from) return { sent: false, reason: "not_configured" };

  const appUrl = (env.NEXT_PUBLIC_APP_URL?.trim() || "").replace(/\/$/, "");
  try {
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // Resend drops repeats of the same key, so webhook retries cannot double-send.
        "Idempotency-Key": `welcome/${input.userId}`,
      },
      body: JSON.stringify({ from, to: [input.to], ...buildWelcomeEmail(input, appUrl) }),
    });
    if (!res.ok) return { sent: false, reason: "failed", detail: `Resend responded ${res.status}` };
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { sent: true, id: data.id ?? null };
  } catch (err) {
    return { sent: false, reason: "failed", detail: err instanceof Error ? err.message : "network error" };
  }
}
