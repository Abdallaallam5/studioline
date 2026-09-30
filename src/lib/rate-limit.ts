import "server-only";
import { RateLimit } from "@/models";

/**
 * Fixed-window rate limiter backed by MongoDB so it works across serverless
 * instances. Returns true when the call is allowed.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const now = new Date();
  const existing = await RateLimit.findOneAndUpdate({ key, expiresAt: { $gt: now } }, { $inc: { count: 1 } }, { returnDocument: "after" }).lean();
  if (existing) return existing.count <= limit;

  try {
    await RateLimit.findOneAndUpdate(
      { key },
      { $set: { count: 1, expiresAt: new Date(now.getTime() + windowSeconds * 1000) } },
      { upsert: true },
    );
  } catch {
    // Lost an upsert race with a concurrent request; allowing this one is fine.
  }
  return true;
}
