import { describe, expect, it } from "vitest";
import { createTestDb } from "@/tests/helpers/db";
import { profile, settings } from "@/src/db/schema";

describe("schema", () => {
  it("applies migrations and seeds the singleton rows", async () => {
    const db = await createTestDb();
    const rows = await db.select().from(settings);
    expect(rows).toHaveLength(1);
    expect(rows[0].hideZero).toBe(false);
    expect(rows[0].psnAuthStatus).toBe("missing");
    expect(await db.select().from(profile)).toHaveLength(1);
  });
});
