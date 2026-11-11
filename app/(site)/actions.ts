"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CabinetValidationError, saveCabinet } from "@/src/cabinet/repo";
import { requireSession } from "@/src/auth/require-session";
import { getDb } from "@/src/db/client";
import type { AdvisorDlc } from "@/src/db/schema";
import { setAdvisorDlc, setAdvisorHideUnobtainable, setHideZero } from "@/src/settings/repo";

export async function toggleHideZero(on: boolean): Promise<void> {
  await requireSession();
  if (typeof on !== "boolean") throw new Error("Invalid value");
  await setHideZero(await getDb(), on);
  revalidatePath("/");
}

export async function toggleAdvisorHideUnobtainable(on: boolean): Promise<void> {
  await requireSession();
  if (typeof on !== "boolean") throw new Error("Invalid value");
  await setAdvisorHideUnobtainable(await getDb(), on);
  revalidatePath("/trophy-advisor");
}

export async function setAdvisorDlcMode(mode: AdvisorDlc): Promise<void> {
  await requireSession();
  if (mode !== "all" && mode !== "hide" && mode !== "only") throw new Error("Invalid value");
  await setAdvisorDlc(await getDb(), mode);
  revalidatePath("/trophy-advisor");
}

const cabinetEntries = z
  .array(z.object({
      titleId: z.string().min(1).max(64),
      trophyId: z.number().int().min(0).max(2147483647),
    }))
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
    if (e instanceof CabinetValidationError) return { ok: false, error: e.message };
    console.error("saveCabinetAction failed", e);
    return { ok: false, error: "Could not save the cabinet." };
  }
  revalidatePath("/");
  return { ok: true };
}
