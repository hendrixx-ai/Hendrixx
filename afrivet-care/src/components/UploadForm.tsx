"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ACCEPT, validateUpload } from "@/lib/storage";

interface Props {
  petId: string;
  purpose?: "photo" | "file";
  label: string;
  className?: string;
}

export function UploadForm({ petId, purpose = "file", label, className = "btn btn-secondary" }: Props) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    const problem = validateUpload(file);
    if (problem) return setError(problem);
    setError(null);
    setBusy(true);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("pet_id", petId);
      body.set("purpose", purpose);
      const res = await fetch("/api/upload", { method: "POST", body });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Upload failed. Please try again.");
      } else {
        router.refresh();
      }
    } catch {
      setError("Upload failed. Check your connection and try again.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="upload">
      <label className={`${className}${busy ? " is-busy" : ""}`}>
        <input
          ref={input}
          type="file"
          className="visually-hidden"
          accept={purpose === "photo" ? "image/jpeg,image/png,image/webp" : ACCEPT}
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        {busy ? "Uploading…" : label}
      </label>
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
}
