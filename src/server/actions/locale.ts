"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth/session";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n/config";
import { User } from "@/models";

/** Remember the interface language: in a cookie for everyone, and on the account for emails. */
export async function setLocale(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });

  const user = await getCurrentUser();
  if (user) await User.updateOne({ _id: user.id }, { $set: { locale } });
  revalidatePath("/", "layout");
}
