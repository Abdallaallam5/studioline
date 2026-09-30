import { Download, File as FileIcon, FileText, Film, Image as ImageIcon, Music } from "lucide-react";
import type { ReactNode } from "react";
import { fileKind } from "@/lib/storage/rules";
import { formatBytes } from "@/lib/utils";
import type { IFileAsset } from "@/models";
import { getT } from "@/lib/i18n/server";

const icons = { image: <ImageIcon />, video: <Film />, audio: <Music />, document: <FileText /> };

/** Links to the access-checked file endpoint; nothing here exposes storage URLs. */
export async function AttachmentList({ files, action }: { files: IFileAsset[]; action?: (file: IFileAsset) => ReactNode }) {
  const t = await getT();
  if (files.length === 0) return null;
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {files.map((file) => {
        const id = String(file._id);
        return (
          <li key={id} className="flex items-center gap-2.5 rounded-lg border border-line bg-surface px-2.5 py-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-paper text-muted [&_svg]:size-4">{icons[fileKind(file.mimeType)] ?? <FileIcon />}</span>
            <a href={`/api/files/${id}`} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium hover:text-brand hover:underline">{file.originalName}</span>
              <span className="block text-xs text-muted">{formatBytes(file.size)}</span>
            </a>
            <a href={`/api/files/${id}?download`} className="rounded-md p-1.5 text-muted hover:bg-ink/5 hover:text-ink" aria-label={t("Download {name}", { name: file.originalName })} title={t("Download")}>
              <Download className="size-4" />
            </a>
            {action?.(file)}
          </li>
        );
      })}
    </ul>
  );
}
