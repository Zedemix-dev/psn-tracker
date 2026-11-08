"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { saveCabinet } from "@/src/cabinet/repo";
import { requireSession } from "@/src/auth/require-session";
import { getDb } from "@/src/db/client";
import { setHideZero } from "@/src/settings/repo";

export async function toggleHideZero(on: boolean): Promise<void> {
  await requireSession();
  if (typeof on !== "boolean") throw new Error("Invalid value");
  await setHideZero(await getDb(), on);
  revalidatePath("/");
}

const cabinetEntries = z
  .array(z.object({ titleId: z.string().min(1), trophyId: z.number().int() }))
  .max(10);

export async function saveCabinetAction(
  entries: { titleId: string; trophyId: number }[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireSession();
  const parsed = cabinetEntries.safeParse(entries);
  if (!parsed.success) return { ok: false, error: "Invalid cabinet" };
  try {
    await saveCabinet(await getDb(), parsed.data);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not save the cabinet" };
  }
  revalidatePath("/");
  return { ok: true };
}
