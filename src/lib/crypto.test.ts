import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decrypt, encrypt } from "@/src/lib/crypto";

const key = randomBytes(32);

describe("crypto", () => {
  it("round-trips and uses the v1 format", () => {
    const token = encrypt("secret npsso", key);
    expect(token).toMatch(/^v1\.[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(token).not.toContain("secret");
    expect(decrypt(token, key)).toBe("secret npsso");
  });
  it("uses a fresh IV each time", () => {
    expect(encrypt("a", key)).not.toBe(encrypt("a", key));
  });
  it("throws when a byte is tampered with", () => {
    const [v, iv, tag, data] = encrypt("hello world", key).split(".");
    const buf = Buffer.from(data, "base64url");
    buf[0] ^= 1;
    expect(() => decrypt([v, iv, tag, buf.toString("base64url")].join("."), key)).toThrow();
  });
  it("throws with a different key", () => {
    expect(() => decrypt(encrypt("hello", key), randomBytes(32))).toThrow();
  });
  it("throws on a truncated tag", () => {
    const [v, iv, tag, data] = encrypt("hello world", key).split(".");
    const short = Buffer.from(tag, "base64url").subarray(0, 12).toString("base64url");
    expect(() => decrypt([v, iv, short, data].join("."), key)).toThrow();
  });
  it("throws on a wrong prefix", () => {
    expect(() => decrypt(encrypt("hello", key).replace("v1.", "v2."), key)).toThrow();
  });
});
