/**
 * File storage. Files are private: they are only ever served through
 * /api/files/[id], which checks that the signed-in user owns the attachment.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // Vercel functions accept ~4.5 MB request bodies.
export const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};
export const ACCEPT = Object.keys(ALLOWED_TYPES).join(",");

export interface UploadLike {
  name: string;
  type: string;
  size: number;
}

export function validateUpload(file: UploadLike | null | undefined): string | null {
  if (!file || !file.size) return "Choose a file to upload.";
  if (!ALLOWED_TYPES[file.type]) return "Only JPG, PNG, WebP images and PDF files can be uploaded.";
  if (file.size > MAX_UPLOAD_BYTES) return "That file is larger than 4 MB. Please choose a smaller one.";
  return null;
}

/** Checks the first bytes so a renamed file cannot pose as an image or PDF. */
export function matchesSignature(type: string, bytes: Uint8Array): boolean {
  const starts = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  switch (type) {
    case "image/jpeg":
      return starts(0xff, 0xd8, 0xff);
    case "image/png":
      return starts(0x89, 0x50, 0x4e, 0x47);
    case "application/pdf":
      return starts(0x25, 0x50, 0x44, 0x46);
    case "image/webp":
      return starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45;
    default:
      return false;
  }
}

export function safeFileName(name: string): string {
  const cleaned = name.normalize("NFKD").replace(/[^\w.\- ]+/g, "").trim().slice(0, 120);
  return cleaned || "file";
}

export interface StoredFile {
  storage: "blob" | "memory";
  storage_key: string;
}
export interface FileStore {
  put(path: string, bytes: Uint8Array, contentType: string): Promise<StoredFile>;
  get(key: string): Promise<ReadableStream<Uint8Array> | Uint8Array | null>;
  remove(key: string): Promise<void>;
}

/** Demo-mode store: files live in server memory and vanish on restart. */
export class MemoryFileStore implements FileStore {
  private files = new Map<string, Uint8Array>();
  async put(path: string, bytes: Uint8Array, _contentType?: string) {
    this.files.set(path, bytes);
    return { storage: "memory" as const, storage_key: path };
  }
  async get(key: string) {
    return this.files.get(key) ?? null;
  }
  async remove(key: string) {
    this.files.delete(key);
  }
}

/** Vercel Blob store (private access). Needs BLOB_READ_WRITE_TOKEN. */
export class BlobFileStore implements FileStore {
  async put(path: string, bytes: Uint8Array, contentType: string) {
    const { put } = await import("@vercel/blob");
    const blob = await put(path, Buffer.from(bytes), { access: "private", addRandomSuffix: true, contentType });
    return { storage: "blob" as const, storage_key: blob.pathname };
  }
  async get(key: string) {
    const { get } = await import("@vercel/blob");
    const res = await get(key, { access: "private" });
    return res && res.statusCode === 200 ? res.stream : null;
  }
  async remove(key: string) {
    const { del } = await import("@vercel/blob");
    await del(key);
  }
}
