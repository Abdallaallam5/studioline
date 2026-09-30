import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db";
import { env } from "@/lib/env";

/**
 * File storage abstraction. FileAsset documents hold metadata only; the bytes
 * live with the provider (a GridFS bucket, Cloudinary, or the local disk). Files are private: they are only ever served
 * through /api/files/[id], which checks tenant and task access first.
 */

export type StorageProviderName = "mongodb" | "local" | "cloudinary";

export interface StoredFile {
  provider: StorageProviderName;
  key: string;
  resourceType?: string | null;
  format?: string | null;
}

export interface UploadInput {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  /** Tenant folder; keeps each workspace's files under its own prefix. */
  workspaceId: string;
}

export type Download = { kind: "redirect"; url: string } | { kind: "buffer"; data: Buffer };

export interface StorageProvider {
  upload(input: UploadInput): Promise<StoredFile>;
  download(file: StoredFile, opts: { filename: string; inline: boolean }): Promise<Download>;
  remove(file: StoredFile): Promise<void>;
}

/* ─── MongoDB GridFS (default) ───────────────────────────────────────── */

/*
 * Stores file bytes in a GridFS bucket of the application database, so the app
 * needs no storage service or writable disk — it runs on serverless hosts with
 * nothing but the MongoDB connection. Suited to small files; keep MAX_UPLOAD_MB
 * low and move to Cloudinary if attachments grow (Atlas's free tier is 512 MB).
 */

async function bucket() {
  const { connection } = await connectDb();
  if (!connection.db) throw new Error("Database is not connected");
  return new mongoose.mongo.GridFSBucket(connection.db, { bucketName: "uploads" });
}

const mongodbProvider: StorageProvider = {
  async upload({ buffer, filename, mimeType, workspaceId }) {
    const files = await bucket();
    const stream = files.openUploadStream(filename, { metadata: { workspaceId, mimeType } });
    await new Promise<void>((resolve, reject) => {
      stream.once("finish", () => resolve());
      stream.once("error", reject);
      stream.end(buffer);
    });
    return { provider: "mongodb", key: String(stream.id) };
  },
  async download(file) {
    const files = await bucket();
    const chunks: Buffer[] = [];
    for await (const chunk of files.openDownloadStream(new mongoose.Types.ObjectId(file.key))) chunks.push(chunk as Buffer);
    return { kind: "buffer", data: Buffer.concat(chunks) };
  },
  async remove(file) {
    const files = await bucket();
    await files.delete(new mongoose.Types.ObjectId(file.key)).catch(() => undefined); // already gone is fine
  },
};

/* ─── Local disk (development only) ──────────────────────────────────── */

const LOCAL_ROOT = path.join(process.cwd(), ".uploads");

function localPath(key: string): string {
  const resolved = path.resolve(LOCAL_ROOT, key);
  if (!resolved.startsWith(LOCAL_ROOT + path.sep)) throw new Error("Invalid storage key");
  return resolved;
}

const localProvider: StorageProvider = {
  async upload({ buffer, workspaceId }) {
    const key = `${workspaceId}/${randomUUID()}`;
    const target = localPath(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, buffer);
    return { provider: "local", key };
  },
  async download(file) {
    return { kind: "buffer", data: await readFile(localPath(file.key)) };
  },
  async remove(file) {
    await rm(localPath(file.key), { force: true });
  },
};

/* ─── Cloudinary ─────────────────────────────────────────────────────── */

async function cloudinaryClient() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = env();
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error("Cloudinary credentials are not configured");
  }
  const { v2: cloudinary } = await import("cloudinary");
  cloudinary.config({ cloud_name: CLOUDINARY_CLOUD_NAME, api_key: CLOUDINARY_API_KEY, api_secret: CLOUDINARY_API_SECRET, secure: true });
  return cloudinary;
}

const cloudinaryProvider: StorageProvider = {
  async upload({ buffer, filename, mimeType, workspaceId }) {
    const cloudinary = await cloudinaryClient();
    // Cloudinary stores images, video/audio and PDFs as media (format tracked
    // separately); everything else is "raw" and must carry its own extension.
    const isMedia = /^(image|video|audio)\//.test(mimeType) || mimeType === "application/pdf";
    const ext = path.extname(filename).toLowerCase();
    const result = await new Promise<{ public_id: string; resource_type: string; format?: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `${env().CLOUDINARY_FOLDER}/${workspaceId}`,
          public_id: isMedia ? randomUUID() : `${randomUUID()}${ext}`,
          resource_type: "auto",
          // "authenticated" assets cannot be fetched without a signed URL.
          type: "authenticated",
          use_filename: false,
          overwrite: false,
        },
        (error, res) => (error || !res ? reject(error ?? new Error("Upload failed")) : resolve(res)),
      );
      stream.end(buffer);
    });
    return { provider: "cloudinary", key: result.public_id, resourceType: result.resource_type, format: result.format ?? null };
  },
  async download(file, { inline }) {
    const cloudinary = await cloudinaryClient();
    const url = cloudinary.utils.private_download_url(file.key, file.resourceType === "raw" ? "" : (file.format ?? ""), {
      resource_type: file.resourceType ?? "image",
      type: "authenticated",
      attachment: !inline,
      // Short-lived: the link is minted per request after the access check.
      expires_at: Math.floor(Date.now() / 1000) + 300,
    });
    return { kind: "redirect", url };
  },
  async remove(file) {
    const cloudinary = await cloudinaryClient();
    await cloudinary.uploader.destroy(file.key, { resource_type: file.resourceType ?? "image", type: "authenticated", invalidate: true });
  },
};

const providers: Record<StorageProviderName, StorageProvider> = {
  mongodb: mongodbProvider,
  local: localProvider,
  cloudinary: cloudinaryProvider,
};

/** Provider used for new uploads. */
export function storage(): StorageProvider {
  return providers[env().STORAGE_PROVIDER];
}

/** Provider that holds an existing file (it may predate a provider switch). */
export function storageFor(file: StoredFile): StorageProvider {
  return providers[file.provider];
}
