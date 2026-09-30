/** Upload rules shared by the upload endpoint and the client-side picker. */

export const ALLOWED_EXTENSIONS = [
  // images
  "jpg", "jpeg", "png", "gif", "webp", "heic", "bmp", "tiff",
  // video
  "mp4", "mov", "webm", "avi", "mkv", "m4v",
  // audio
  "mp3", "wav", "m4a", "aac",
  // documents
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "md", "rtf", "odt", "ods", "odp",
  // design
  "psd", "ai", "eps", "indd", "fig", "sketch", "xd",
  // archives
  "zip", "rar", "7z",
] as const;

export const MAX_FILES_PER_UPLOAD = 10;

/** Types that are safe to render in the browser; everything else downloads. */
const INLINE_MIME = /^(image\/(jpeg|png|gif|webp|bmp)|video\/(mp4|webm|quicktime)|audio\/(mpeg|wav|mp4|aac)|application\/pdf)$/;

export function extensionOf(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i === -1 ? "" : filename.slice(i + 1).toLowerCase();
}

export function isAllowedFile(filename: string): boolean {
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(extensionOf(filename));
}

export function canRenderInline(mimeType: string): boolean {
  return INLINE_MIME.test(mimeType);
}

export function fileKind(mimeType: string): "image" | "video" | "audio" | "document" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "document";
}

export const ACCEPT_ATTRIBUTE = ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(",");
