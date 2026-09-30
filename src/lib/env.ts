import "server-only";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  /** Public base URL for links. Optional on Vercel, where the project domain is used. */
  APP_URL: z.url().optional(),
  VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),

  EMAIL_PROVIDER: z.enum(["console", "smtp", "resend"]).default("console"),
  EMAIL_FROM: z.string().default("Studioline <no-reply@example.com>"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),

  STORAGE_PROVIDER: z.enum(["mongodb", "local", "cloudinary"]).default("mongodb"),
  // Serverless hosts cap request bodies (Vercel: 4.5 MB), so the default stays under that.
  MAX_UPLOAD_MB: z.coerce.number().positive().default(4),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_FOLDER: z.string().default("studioline"),

  CRON_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/** Validated environment. Parsed lazily so `next build` does not need secrets. */
export function env(): Env {
  if (cached) return cached;
  // Treat empty strings ("KEY=") as unset so defaults and optional() behave.
  const raw = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== ""));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export function appUrl(path = ""): string {
  const { APP_URL, VERCEL_PROJECT_PRODUCTION_URL } = env();
  const base = APP_URL ?? (VERCEL_PROJECT_PRODUCTION_URL ? `https://${VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
  return `${base.replace(/\/$/, "")}${path}`;
}
