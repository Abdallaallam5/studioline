import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { connectDb } from "@/lib/db";
import { env } from "@/lib/env";
import { cleanUpOrphanedUploads, sendDeadlineReminders, sendRenewalReminders, syncAllSubscriptions } from "@/server/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: NextRequest): boolean {
  const secret = env().CRON_SECRET;
  if (!secret) return false; // fail closed when unconfigured
  const provided = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

/**
 * Scheduled maintenance, triggered by Vercel Cron (see vercel.json) or any
 * scheduler that sends `Authorization: Bearer $CRON_SECRET`. Subscription
 * status is also refreshed lazily on every request, so this job mainly exists
 * to send emails/notifications on time for workspaces nobody is visiting.
 */
export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDb();
  const subscriptions = await syncAllSubscriptions();
  const renewalReminders = await sendRenewalReminders();
  const deadlines = await sendDeadlineReminders();
  const orphanedUploads = await cleanUpOrphanedUploads();

  return NextResponse.json({ ok: true, subscriptions, renewalReminders, deadlines, orphanedUploads });
}
