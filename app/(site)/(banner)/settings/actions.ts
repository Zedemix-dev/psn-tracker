"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { SESSION_COOKIE } from "@/src/auth/cookie";
import { requireSession } from "@/src/auth/require-session";
import { deleteAllSessions } from "@/src/auth/sessions";
import { getDb } from "@/src/db/client";
import { getConfig } from "@/src/lib/config";
import { createPsnGateway } from "@/src/psn/gateway";
import { removeBannerFile, storeBannerFile, validateBannerUpload } from "@/src/settings/banner";
import { NPSSO_INVALID, saveNpssoToken, type FormResult } from "@/src/settings/npsso";
import { getSettings, saveUnobtainableUrl, setBanner } from "@/src/settings/repo";
import { isListUrl } from "@/src/unobtainable/list";

const GENERIC: FormResult = { ok: false, message: "Something went wrong. Try again." };
const posSchema = z.number().finite();
const npssoSchema = z.string().max(256);
const listUrlSchema = z.string().trim().max(2048);
const clampPos = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

function fail(action: string, e: unknown): FormResult {
  console.error(`${action} failed`, e);
  return GENERIC;
}

export async function uploadBanner(_prev: FormResult | null, form: FormData): Promise<FormResult> {
  await requireSession();
  const file = form.get("banner");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose an image first." };
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const check = validateBannerUpload(bytes, file.size);
    if (!check.ok) return { ok: false, message: check.error };
    const db = await getDb();
    const { mediaDir } = getConfig();
    const { bannerPath: previous, bannerPosY } = await getSettings(db);
    const rel = await storeBannerFile(mediaDir, bytes, check.ext);
    await setBanner(db, rel, bannerPosY);
    await removeBannerFile(mediaDir, previous);
    revalidatePath("/", "layout");
    return { ok: true, message: "Banner updated." };
  } catch (e) {
    return fail("uploadBanner", e);
  }
}

export async function saveBannerPosition(posY: number): Promise<FormResult> {
  await requireSession();
  const parsed = posSchema.safeParse(posY);
  if (!parsed.success) return { ok: false, message: "Invalid position." };
  try {
    const db = await getDb();
    const { bannerPath } = await getSettings(db);
    if (!bannerPath) return { ok: false, message: "Upload a banner first." };
    await setBanner(db, bannerPath, clampPos(parsed.data));
    revalidatePath("/", "layout");
    return { ok: true, message: "Position saved." };
  } catch (e) {
    return fail("saveBannerPosition", e);
  }
}

export async function resetBanner(): Promise<FormResult> {
  await requireSession();
  try {
    const db = await getDb();
    const { bannerPath } = await getSettings(db);
    await setBanner(db, null, 50);
    await removeBannerFile(getConfig().mediaDir, bannerPath);
    revalidatePath("/", "layout");
    return { ok: true, message: "Default banner restored." };
  } catch (e) {
    return fail("resetBanner", e);
  }
}

export async function saveNpsso(_prev: FormResult | null, form: FormData): Promise<FormResult> {
  await requireSession();
  const parsed = npssoSchema.safeParse(form.get("npsso") ?? "");
  if (!parsed.success) return { ok: false, message: NPSSO_INVALID };
  try {
    const cfg = getConfig();
    const res = await saveNpssoToken(
      await getDb(),
      createPsnGateway(cfg.psnLanguage),
      cfg.appSecret,
      parsed.data,
      new Date(),
    );
    if (res.ok) revalidatePath("/", "layout");
    return res;
  } catch (e) {
    return fail("saveNpsso", e);
  }
}

export async function saveUnobtainableListUrl(_prev: FormResult | null, form: FormData): Promise<FormResult> {
  await requireSession();
  const parsed = listUrlSchema.safeParse(form.get("url") ?? "");
  if (!parsed.success || !isListUrl(parsed.data)) return { ok: false, message: "Enter an http or https address." };
  try {
    await saveUnobtainableUrl(await getDb(), parsed.data, new Date());
    revalidatePath("/", "layout");
    return { ok: true, message: "Saved. Downloading the list…" };
  } catch (e) {
    return fail("saveUnobtainableListUrl", e);
  }
}

export async function logout(): Promise<void> {
  await requireSession();
  await deleteAllSessions(await getDb());
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
