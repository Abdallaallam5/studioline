import "server-only";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

const BCRYPT_COST = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Compared against when no user matches, so response time does not reveal
// whether an email is registered.
let dummyHash: Promise<string> | null = null;
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= bcrypt.hash("timing-equalizer", BCRYPT_COST);
  await bcrypt.compare(password, await dummyHash);
}

/** Tokens are stored hashed; a database leak must not yield usable links or sessions. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: hashToken(raw) };
}
