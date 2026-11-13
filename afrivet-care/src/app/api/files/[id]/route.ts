import { getFileStore, getOwnerId, getRepo } from "@/lib/server";
import { isUuid } from "@/lib/validation";

/** Serves an uploaded file, but only to the user who owns it. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ownerId = await getOwnerId();
  if (!ownerId) return new Response("Sign in required", { status: 401 });

  const repo = await getRepo();
  const attachment = isUuid(id) ? await repo.get("attachments", ownerId, id) : null;
  if (!attachment) return new Response("Not found", { status: 404 });

  const body = await getFileStore(attachment.storage).get(attachment.storage_key);
  if (!body) return new Response("Not found", { status: 404 });

  const isImage = attachment.content_type.startsWith("image/");
  const name = encodeURIComponent(attachment.file_name);
  return new Response(body instanceof Uint8Array ? Buffer.from(body) : body, {
    headers: {
      "Content-Type": attachment.content_type,
      "Content-Disposition": `${isImage ? "inline" : "attachment"}; filename*=UTF-8''${name}`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
