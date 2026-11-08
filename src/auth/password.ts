import bcrypt from "bcryptjs";
import type { AppConfig } from "@/src/lib/config";

export async function verifyLogin(
  username: string,
  password: string,
  cfg: Pick<AppConfig, "adminUsername" | "adminPasswordHash">,
): Promise<boolean> {
  // Always run the hash comparison so a wrong username costs the same as a wrong password.
  const passwordOk = await bcrypt.compare(password, cfg.adminPasswordHash);
  return username === cfg.adminUsername && passwordOk;
}
