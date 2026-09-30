import { PauseCircle } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/primitives";
import { requireEmployee } from "@/server/context";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Workspace paused" };

export default async function PausedPage() {
  const t = await getT();
  const ctx = await requireEmployee({ allowRestricted: true });
  if (ctx.access.workspace) redirect("/my");

  return (
    <Card className="mx-auto mt-10 max-w-md p-8 text-center">
      <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-amber-50 text-amber-700">
        <PauseCircle className="size-5" />
      </div>
      <h1 className="mt-4 text-lg font-semibold">{ctx.workspace.name} {t("is paused")}</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        {t("This workspace isn't available right now. Your tasks and files are safe and will be back as soon as your manager restores access. Please contact them for details.")}
      </p>
    </Card>
  );
}
