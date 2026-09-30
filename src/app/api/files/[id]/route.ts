import { isValidObjectId } from "mongoose";
import { NextResponse, type NextRequest } from "next/server";
import { storageFor } from "@/lib/storage";
import { canRenderInline } from "@/lib/storage/rules";
import { FileAsset, Task } from "@/models";
import { getMemberContext } from "@/server/context";
import { scope, taskScope } from "@/server/tenant";

export const runtime = "nodejs";

const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });

/**
 * The only way to read an uploaded file. Access is checked on every request:
 * the file must belong to the caller's workspace, and employees must either be
 * assigned to the task it is attached to or have uploaded it themselves.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getMemberContext();
  if (!ctx) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!ctx.access.workspace || !isValidObjectId(id)) return notFound();

  const file = await FileAsset.findOne({ _id: id, ...scope(ctx) }).lean();
  if (!file) return notFound();

  if (ctx.user.role === "EMPLOYEE") {
    const ownUpload = String(file.uploadedBy) === ctx.user.id;
    const onOwnTask = file.taskId ? await Task.exists({ _id: file.taskId, ...taskScope(ctx) }) : null;
    if (!ownUpload && !onOwnTask) return notFound();
  }

  const forceDownload = request.nextUrl.searchParams.has("download");
  const inline = !forceDownload && canRenderInline(file.mimeType);

  try {
    const download = await storageFor(file).download(file, { filename: file.originalName, inline });
    if (download.kind === "redirect") return NextResponse.redirect(download.url, 302);

    return new NextResponse(new Uint8Array(download.data), {
      headers: {
        "Content-Type": inline ? file.mimeType : "application/octet-stream",
        "Content-Length": String(download.data.byteLength),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
        "Cache-Control": "private, no-store",
        // Only allow-listed media types are ever served inline (never HTML or SVG).
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("[files] failed to read file:", err);
    return NextResponse.json({ error: "File is unavailable" }, { status: 502 });
  }
}
