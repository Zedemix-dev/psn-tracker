import { describe, expect, it } from "vitest";
import { getConfigFrom } from "./config";

const validEnv: Record<string, string | undefined> = {
  DATABASE_URL: "pglite:memory",
  ADMIN_USERNAME: "admin",
  ADMIN_PASSWORD_HASH: "$2a$10$abcdefghijklmnopqrstuv",
  APP_SECRET: Buffer.alloc(32, 7).toString("base64"),
  PSN_LANGUAGE: "fr-FR",
  MEDIA_DIR: "./.data/media",
};

describe("getConfig", () => {
  it("defaults the PSN language to en-GB", () => {
    expect(getConfigFrom({ ...validEnv, PSN_LANGUAGE: undefined }).psnLanguage).toBe("en-GB");
  });
  it("rejects an APP_SECRET that is not 32 bytes of base64", () => {
    expect(() => getConfigFrom({ ...validEnv, APP_SECRET: "short" })).toThrow(/APP_SECRET/);
  });
  it("decodes APP_SECRET into a 32-byte Buffer", () => {
    const cfg = getConfigFrom(validEnv);
    expect(cfg.appSecret.length).toBe(32);
    expect(cfg.databaseUrl).toBe("pglite:memory");
  });
  it("names the missing variable", () => {
    expect(() => getConfigFrom({ ...validEnv, DATABASE_URL: undefined })).toThrow(/DATABASE_URL/);
  });
});
