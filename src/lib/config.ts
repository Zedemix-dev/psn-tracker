import { z } from "zod";

export type AppConfig = {
  databaseUrl: string;
  adminUsername: string;
  adminPasswordHash: string;
  appSecret: Buffer; // 32 bytes
  psnLanguage: string;
  mediaDir: string;
};

const required = (name: string) =>
  z
    .string({ error: `${name} is required` })
    .min(1, `${name} is required`);

const schema = z.object({
  DATABASE_URL: required("DATABASE_URL"),
  ADMIN_USERNAME: required("ADMIN_USERNAME"),
  ADMIN_PASSWORD_HASH: required("ADMIN_PASSWORD_HASH"),
  APP_SECRET: required("APP_SECRET").refine(
    (v) => /^[A-Za-z0-9+/]+={0,2}$/.test(v) && Buffer.from(v, "base64").length === 32,
    "APP_SECRET must be 32 bytes encoded as base64",
  ),
  PSN_LANGUAGE: z.string().min(1).default("en-GB"),
  MEDIA_DIR: z.string().min(1).default("./.data/media"),
});

export function getConfigFrom(env: Record<string, string | undefined>): AppConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `${i.path.join(".") || "env"}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid configuration: ${details}`);
  }
  const e = parsed.data;
  return {
    databaseUrl: e.DATABASE_URL,
    adminUsername: e.ADMIN_USERNAME,
    adminPasswordHash: e.ADMIN_PASSWORD_HASH,
    appSecret: Buffer.from(e.APP_SECRET, "base64"),
    psnLanguage: e.PSN_LANGUAGE,
    mediaDir: e.MEDIA_DIR,
  };
}

let cached: AppConfig | undefined;

export function getConfig(): AppConfig {
  cached ??= getConfigFrom(process.env);
  return cached;
}
