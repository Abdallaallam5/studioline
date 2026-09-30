import { Activity } from "lucide-react";
import { EmptyState } from "@/components/ui/primitives";
import type { IActivityLog } from "@/models";
import { getT } from "@/lib/i18n/server";

/** Chronological audit entries. `label` optionally maps an action code to a short tag. */
export async function ActivityList({ items, timezone = "UTC", label, emptyText }: { items: IActivityLog[]; timezone?: string; label?: (action: string) => string | undefined; emptyText?: string }) {
  const t = await getT();
  if (items.length === 0) return <EmptyState icon={<Activity />} title={t("No activity yet")} description={emptyText ?? t("Nothing has happened here yet.")} />;

  return (
    <ol className="divide-y divide-line">
      {items.map((item) => (
        <li key={String(item._id)} className="flex gap-3 px-4 py-3">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-line-strong" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-snug text-ink">{t.msg(item.summaryT, item.summary)}</p>
            <p className="mt-0.5 text-xs text-muted">
              {label?.(item.action) ? `${t(label(item.action)!)} · ` : ""}
              {item.actorId ? item.actorName : t(item.actorName)} · <time dateTime={item.createdAt.toISOString()} title={t.dateTime(item.createdAt, timezone)}>{t.ago(item.createdAt)}</time>
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
