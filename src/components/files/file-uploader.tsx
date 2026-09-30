"use client";

import { LoaderCircle, Paperclip, X } from "lucide-react";
import { useRef, useState } from "react";
import { useFormContext } from "@/components/ui/action-form";
import { ACCEPT_ATTRIBUTE, isAllowedFile, MAX_FILES_PER_UPLOAD } from "@/lib/storage/rules";
import { formatBytes } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

interface Uploaded {
  id: string;
  name: string;
  size: number;
}

/**
 * Uploads files as soon as they are picked and contributes their ids to the
 * surrounding form as `fileIds[]`. The server action then attaches them.
 */
export function FileUploader(props: { maxMb: number; name?: string }) {
  // Re-mounting on resetKey clears the list after a successful submit.
  const { resetKey } = useFormContext();
  return <Uploader key={resetKey} {...props} />;
}

function Uploader({ maxMb, name = "fileIds[]" }: { maxMb: number; name?: string }) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<Uploaded[]>([]);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function onPick(list: FileList | null) {
    if (!list || list.length === 0) return;
    const picked = Array.from(list);
    if (inputRef.current) inputRef.current.value = "";
    setError(null);

    if (files.length + picked.length > MAX_FILES_PER_UPLOAD) return setError(t("Attach at most {max} files.", { max: MAX_FILES_PER_UPLOAD }));
    const rejected = picked.find((f) => !isAllowedFile(f.name));
    if (rejected) return setError(t('"{name}" is not an allowed file type.', { name: rejected.name }));
    const tooLarge = picked.find((f) => f.size > maxMb * 1024 * 1024);
    if (tooLarge) return setError(t('"{name}" is larger than {max} MB.', { name: tooLarge.name, max: maxMb }));

    setUploading((n) => n + picked.length);
    // One request per file keeps each request small and lets partial success stand.
    await Promise.all(
      picked.map(async (file) => {
        try {
          const body = new FormData();
          body.append("files", file);
          const res = await fetch("/api/uploads", { method: "POST", body });
          const json = (await res.json().catch(() => null)) as { files?: Uploaded[]; error?: string } | null;
          if (!res.ok || !json?.files) throw new Error(json?.error ?? t('Could not upload "{name}".', { name: file.name }));
          setFiles((current) => [...current, ...json.files!]);
        } catch (err) {
          setError(err instanceof Error ? err.message : t("Upload failed."));
        } finally {
          setUploading((n) => n - 1);
        }
      }),
    );
  }

  return (
    <div className="space-y-2">
      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((file) => (
            <li key={file.id} className="flex items-center gap-2 rounded-lg border border-line bg-paper/60 px-2.5 py-1.5 text-[13px]">
              <Paperclip className="size-3.5 shrink-0 text-muted" />
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              <span className="shrink-0 text-xs text-muted">{formatBytes(file.size)}</span>
              <button type="button" onClick={() => setFiles((c) => c.filter((f) => f.id !== file.id))} className="rounded p-0.5 text-muted hover:text-danger" aria-label={t("Remove {name}", { name: file.name })}>
                <X className="size-3.5" />
              </button>
              <input type="hidden" name={name} value={file.id} />
            </li>
          ))}
        </ul>
      )}

      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong px-3 py-3 text-[13px] text-ink-soft transition-colors hover:border-brand hover:bg-brand-soft/40 has-[:focus-visible]:border-brand">
        {uploading > 0 ? <LoaderCircle className="size-4 animate-spin text-brand" /> : <Paperclip className="size-4 text-muted" />}
        {uploading > 0 ? t("Uploading {count} files…", { count: uploading }) : t("Attach files")}
        <span className="text-xs text-muted">{t("up to")} {maxMb} {t("MB each")}</span>
        <input ref={inputRef} type="file" multiple accept={ACCEPT_ATTRIBUTE} className="sr-only" disabled={uploading > 0} onChange={(e) => onPick(e.target.files)} />
      </label>
      {/* Blocks submission while an upload is still in flight. */}
      {uploading > 0 && <input type="hidden" name="__uploading" value="1" />}
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
