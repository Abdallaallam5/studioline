/**
 * Create (or reset the password of) the platform owner account.
 *
 *   OWNER_NAME, OWNER_EMAIL and OWNER_PASSWORD are read from the environment.
 *   npm run seed:owner
 */
import "./load-env";
import mongoose from "mongoose";
import { hashPassword } from "@/lib/auth/crypto";
import { connectDb } from "@/lib/db";
import { PlatformSettings, User } from "@/models";

async function main() {
  const name = process.env.OWNER_NAME?.trim() || "Platform Owner";
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.OWNER_PASSWORD;

  if (!email || !password) throw new Error("Set OWNER_EMAIL and OWNER_PASSWORD in your environment (.env) before running this script.");
  if (password.length < 10 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    throw new Error("OWNER_PASSWORD must be at least 10 characters and contain a letter and a number.");
  }

  await connectDb();

  const existing = await User.findOne({ email });
  if (existing && existing.role !== "OWNER") {
    throw new Error(`${email} already belongs to a ${existing.role.toLowerCase()} account. Choose a different OWNER_EMAIL.`);
  }

  await User.findOneAndUpdate(
    { email },
    { $set: { name, passwordHash: await hashPassword(password), role: "OWNER", workspaceId: null, emailVerifiedAt: new Date(), disabledAt: null } },
    { upsert: true },
  );
  await PlatformSettings.findOneAndUpdate({ key: "platform" }, { $setOnInsert: { key: "platform" } }, { upsert: true });

  console.log(`${existing ? "Updated" : "Created"} owner account: ${email}`);
  console.log("You can now remove OWNER_PASSWORD from your environment.");
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
