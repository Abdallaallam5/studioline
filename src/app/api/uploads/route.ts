import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { getT } from "@/lib/i18n/server";
import { storage } from "@/lib/storage";
import { isAllowedFile, MAX_FILES_PER_UPLOAD } from "@/lib/storage/rules";
import { FileAsset } from "@/models";
import { getMemberContext } from "@/server/context";

export const runtime = "nodejs";
export const maxDuration = 60;

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Upload files to object storage. The response contains FileAsset ids; they
 * become attachments only when a server action later claims them for a task
 * the uploader is allowed to touch (see claimUploads).
 */
export async function POST(request: NextRequest) {
  // Same-origin only: a cookie-authenticated endpoint must not accept cross-site posts.
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) return error("Forbidden", 403);

  const t = await getT();
  const ctx = await getMemberContext();
  if (!ctx) return error(t("Not signed in"), 401);
  if (!ctx.access.write) return error(t("This workspace is read-only right now."), 403);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return error(t("Invalid upload"), 400);
  }
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return error(t("No files were provided."), 400);
  if (files.length > MAX_FILES_PER_UPLOAD) return error(t("Attach at most {max} files.", { max: MAX_FILES_PER_UPLOAD }), 400);

  const maxBytes = env().MAX_UPLOAD_MB * 1024 * 1024;
  for (const file of files) {
    if (!isAllowedFile(file.name)) return error(t('"{name}" is not an allowed file type.', { name: file.name }), 415);
    if (file.size > maxBytes) return error(t('"{name}" is larger than {max} MB.', { name: file.name, max: env().MAX_UPLOAD_MB }), 413);
  }

  const uploaded = [];
  for (const file of files) {
    const mimeType = file.type || "application/octet-stream";
    try {
      const stored = await storage().upload({
        buffer: Buffer.from(await file.arrayBuffer()),
        filename: file.name,
        mimeType,
        workspaceId: ctx.workspace.id,
      });
      const asset = await FileAsset.create({
        workspaceId: ctx.workspace.id,
        uploadedBy: ctx.user.id,
        provider: stored.provider,
        key: stored.key,
        resourceType: stored.resourceType ?? null,
        format: stored.format ?? null,
        originalName: file.name.slice(0, 255),
        mimeType,
        size: file.size,
      });
      uploaded.push({ id: String(asset._id), name: asset.originalName, size: asset.size, mimeType: asset.mimeType });
    } catch (err) {
      console.error("[uploads] failed to store file:", err);
      return error(t('"{name}" could not be uploaded. Please try again.', { name: file.name }), 502);
    }
  }

  return NextResponse.json({ files: uploaded });
}
