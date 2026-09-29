import { z } from "zod";

/**
 * Server environment, validated once. Import `env` instead of reading
 * process.env directly so misconfiguration fails loudly at startup rather
 * than halfway through a checkout.
 *
 * In development most providers fall back to local test doubles (file email,
 * local storage, fake Stripe, mock fulfillment). In production those doubles
 * are refused.
 */
const bool = z
  .enum(["true", "false", "1", "0", ""])
  .optional()
  .transform((v) => v === "true" || v === "1");

const optionalUrl = z
  .string()
  .optional()
  .transform((v) => (v ? v.replace(/\/$/, "") : undefined))
  .pipe(z.string().url().optional());

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000").transform((v) => v.replace(/\/$/, "")),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  APP_SECRET: z.string().optional(),

  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default("storage/objects"),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().default("auto"),
  S3_ENDPOINT: optionalUrl,
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: bool,
  ALLOW_LOCAL_STORAGE_IN_PRODUCTION: bool,

  PAYMENTS_PROVIDER: z.enum(["stripe", "fake"]).optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_TAX_ENABLED: bool,

  FULFILLMENT_PROVIDER: z.enum(["prodigi", "mock"]).optional(),
  FULFILLMENT_AUTO_SUBMIT: z.enum(["true", "false"]).default("true").transform((v) => v === "true"),
  /** Hours between payment and sending to the lab, so customers can fix typos (as the confirmation email promises). */
  FULFILLMENT_HOLD_HOURS: z.coerce.number().min(0).max(72).default(12),
  PRODIGI_API_KEY: z.string().optional(),
  PRODIGI_ENV: z.enum(["sandbox", "live"]).default("sandbox"),
  PRODIGI_CALLBACK_SECRET: z.string().optional(),
  PRODIGI_SHIPPING_METHOD: z.enum(["Budget", "Standard", "Express", "Overnight"]).default("Standard"),

  EMAIL_PROVIDER: z.enum(["resend", "file"]).optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_WEBHOOK_SECRET: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  EMAIL_REPLY_TO: z.string().optional(),

  ADMIN_EMAILS: z
    .string()
    .default("")
    .transform((v) =>
      v
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),

  SENTRY_DSN: z.string().optional(),
  CHROMIUM_PATH: z.string().optional(),
  SHIPPING_EXPRESS_CENTS: z.coerce.number().int().min(0).optional(),
  SHIPPING_COUNTRIES: z.string().default("US").transform((v) => v.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean)),
  STRIPE_TAX_CODE: z.string().default("txcd_99999999"),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(2),
});

export type Env = z.infer<typeof schema> & {
  isProd: boolean;
  appSecret: string;
  paymentsProvider: "stripe" | "fake";
  fulfillmentProvider: "prodigi" | "mock";
  emailProvider: "resend" | "file";
  emailFrom: string;
};

const DEV_SECRET = "dev-only-secret-do-not-use-in-production-000000";

function build(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const e = parsed.data;
  const isProd = e.NODE_ENV === "production";
  const problems: string[] = [];

  const appSecret = e.APP_SECRET || (isProd ? "" : DEV_SECRET);
  if (isProd && (!e.APP_SECRET || e.APP_SECRET.length < 32)) problems.push("APP_SECRET must be set to a random string of at least 32 characters.");

  const paymentsProvider = e.PAYMENTS_PROVIDER ?? (e.STRIPE_SECRET_KEY ? "stripe" : "fake");
  if (paymentsProvider === "stripe") {
    if (!e.STRIPE_SECRET_KEY) problems.push("STRIPE_SECRET_KEY is required when PAYMENTS_PROVIDER=stripe.");
    if (!e.STRIPE_WEBHOOK_SECRET) problems.push("STRIPE_WEBHOOK_SECRET is required when PAYMENTS_PROVIDER=stripe.");
  }
  if (isProd && paymentsProvider === "fake") problems.push("PAYMENTS_PROVIDER=fake is for local development only.");

  const fulfillmentProvider = e.FULFILLMENT_PROVIDER ?? (e.PRODIGI_API_KEY ? "prodigi" : "mock");
  if (fulfillmentProvider === "prodigi" && !e.PRODIGI_API_KEY) problems.push("PRODIGI_API_KEY is required when FULFILLMENT_PROVIDER=prodigi.");
  if (fulfillmentProvider === "prodigi" && (!e.PRODIGI_CALLBACK_SECRET || e.PRODIGI_CALLBACK_SECRET.length < 16))
    problems.push("PRODIGI_CALLBACK_SECRET (16+ random characters) is required when FULFILLMENT_PROVIDER=prodigi.");
  if (isProd && fulfillmentProvider === "mock") problems.push("FULFILLMENT_PROVIDER=mock is for local development only.");

  const emailProvider = e.EMAIL_PROVIDER ?? (e.RESEND_API_KEY ? "resend" : "file");
  if (emailProvider === "resend" && !e.RESEND_API_KEY) problems.push("RESEND_API_KEY is required when EMAIL_PROVIDER=resend.");
  if (isProd && emailProvider === "file") problems.push("EMAIL_PROVIDER=file is for local development only.");
  if (isProd && !e.EMAIL_FROM) problems.push("EMAIL_FROM is required in production (e.g. \"Brand <orders@yourdomain.com>\").");

  if (e.STORAGE_DRIVER === "s3") {
    for (const k of ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const) if (!e[k]) problems.push(`${k} is required when STORAGE_DRIVER=s3.`);
  }
  if (isProd && e.STORAGE_DRIVER === "local" && !e.ALLOW_LOCAL_STORAGE_IN_PRODUCTION)
    problems.push("STORAGE_DRIVER=local in production loses customer files on redeploy. Use s3, or set ALLOW_LOCAL_STORAGE_IN_PRODUCTION=true with a persistent volume.");
  if (isProd && !e.NEXT_PUBLIC_APP_URL.startsWith("https://")) problems.push("NEXT_PUBLIC_APP_URL must be https:// in production.");
  if (isProd && e.ADMIN_EMAILS.length === 0) problems.push("ADMIN_EMAILS must list at least one admin email.");

  if (problems.length) {
    const msg = `Environment is not ready:\n${problems.map((p) => `  - ${p}`).join("\n")}`;
    // In production refuse to run half-configured; in dev/test warn once.
    if (isProd && process.env.SKIP_ENV_VALIDATION !== "true") throw new Error(msg);
    if (e.NODE_ENV !== "test") console.warn(msg);
  }

  return {
    ...e,
    isProd,
    appSecret,
    paymentsProvider,
    fulfillmentProvider,
    emailProvider,
    emailFrom: e.EMAIL_FROM || `${process.env.NEXT_PUBLIC_BRAND_NAME || "SoundWave Art"} <orders@example.com>`,
  };
}

let cached: Env | null = null;
export function getEnv(): Env {
  if (!cached) cached = build();
  return cached;
}

/** For tests: re-read process.env. */
export function resetEnvForTests() {
  cached = null;
}
