import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getConfig } from "@/lib/config";
import { getFileStore, getOwnerId, getRepo } from "@/lib/server";
import { createService } from "@/lib/service";
import { ALLOWED_TYPES, matchesSignature, safeFileName, validateUpload } from "@/lib/storage";
import { isUuid } from "@/lib/validation";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/**
 * Upload flow: check sign-in → check the file → check the pet belongs to the user →
 * store the bytes privately → save an attachment row that points at them.
 */
export async function POST(req: Request) {
  const ownerId = await getOwnerId();
  if (!ownerId) return fail("Please sign in.", 401);

  const config = getConfig();
  if (!config.blob && !config.demo && process.env.NODE_ENV === "production") {
    return fail("File storage is not set up yet (BLOB_READ_WRITE_TOKEN is missing).", 503);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("The upload could not be read. Files must be 4 MB or smaller.", 400);
  }
  const file = form.get("file");
  const petId = form.get("pet_id");
  const asPhoto = form.get("purpose") === "photo";
  if (!(file instanceof File)) return fail("Choose a file to upload.", 400);
  const problem = validateUpload(file);
  if (problem) return fail(problem, 400);
  if (asPhoto && !file.type.startsWith("image/")) return fail("A pet photo must be an image.", 400);

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!matchesSignature(file.type, bytes)) return fail("That file does not look like a valid image or PDF.", 400);

  const repo = await getRepo();
  const pet = isUuid(petId) ? await repo.get("pets", ownerId, petId) : null;
  if (!pet) return fail("Pet not found.", 404);

  const store = getFileStore();
  const path = `${ownerId}/${pet.id}/${crypto.randomUUID()}.${ALLOWED_TYPES[file.type]}`;
  const stored = await store.put(path, bytes, file.type);

  const service = createService(repo, store, ownerId);
  const saved = await service
    .create("attachments", {
      pet_id: pet.id,
      file_name: safeFileName(file.name),
      content_type: file.type,
      size_bytes: file.size,
      ...stored,
    })
    .catch(() => null);
  if (!saved || !saved.ok) {
    // Never leave a stored file that no record points at.
    await store.remove(stored.storage_key).catch(() => undefined);
    return fail("The file could not be saved. Please try again.", 500);
  }

  const url = `/api/files/${saved.row.id}`;
  if (asPhoto) await repo.update("pets", ownerId, pet.id, { photo_url: url });
  revalidatePath("/", "layout");
  return NextResponse.json({ id: saved.row.id, url }, { status: 201 });
}
