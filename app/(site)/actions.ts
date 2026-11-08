"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/src/auth/require-session";
import { getDb } from "@/src/db/client";
import { setHideZero } from "@/src/settings/repo";

export async function toggleHideZero(on: boolean): Promise<void> {
  await requireSession();
  if (typeof on !== "boolean") throw new Error("Invalid value");
  await setHideZero(await getDb(), on);
  revalidatePath("/");
}
