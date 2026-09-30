import "server-only";
import { generateToken } from "@/lib/auth/crypto";
import { BRAND } from "@/lib/brand";
import { appUrl } from "@/lib/env";
import { translatorFor } from "@/lib/i18n/server";
import type { ShareLink } from "@/lib/utils";
import { whatsappLink } from "@/lib/whatsapp";
import { AuthToken, type IUser } from "@/models";

const MANUAL_RESET_TTL_HOURS = 24;

/**
 * Create a single-use password-reset link for someone else to pass on. Used by
 * owners (for managers) and managers (for their employees) when the person
 * cannot receive the automated reset email. Callers must authorize first.
 */
export async function createResetLinkFor(user: Pick<IUser, "_id" | "name" | "phone" | "locale">): Promise<ShareLink> {
  await AuthToken.deleteMany({ userId: user._id, type: "PASSWORD_RESET" });
  const { raw, hash } = generateToken();
  await AuthToken.create({ type: "PASSWORD_RESET", tokenHash: hash, userId: user._id, expiresAt: new Date(Date.now() + MANUAL_RESET_TTL_HOURS * 3_600_000) });

  const url = appUrl(`/reset-password/${raw}`);
  const t = translatorFor(user.locale);
  const text = t("Hi {name}, use this link to choose a new {brand} password (valid for 24 hours):\n{url}", { name: user.name.split(" ")[0], brand: BRAND.name, url });
  return { url, whatsapp: whatsappLink(user.phone, text) };
}
