import fs from "node:fs/promises";
import path from "node:path";
import { isAuthenticated } from "@/src/auth/require-session";
import { getConfig } from "@/src/lib/config";
import { MEDIA_CSP } from "@/src/lib/security-headers";
import { resolveMediaPath } from "@/src/sync/images";

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  if (!(await isAuthenticated())) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { path: segments } = await params;
  const file = resolveMediaPath(getConfig().mediaDir, segments);
  const type = file ? CONTENT_TYPES[path.extname(file).toLowerCase()] : undefined;
  if (!file || !type) return new Response("Not found", { status: 404 });
  try {
    const body = await fs.readFile(file);
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "private, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": MEDIA_CSP,
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
