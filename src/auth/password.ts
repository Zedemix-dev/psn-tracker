import bcrypt from "bcryptjs";
import type { AppConfig } from "@/src/lib/config";

/** Longer credentials are refused before bcrypt, so a huge input cannot be used to burn CPU. */
export const MAX_CREDENTIAL_LENGTH = 256;

export async function verifyLogin(
  username: string,
  password: string,
  cfg: Pick<AppConfig, "adminUsername" | "adminPasswordHash">,
): Promise<boolean> {
  if (username.length > MAX_CREDENTIAL_LENGTH || password.length > MAX_CREDENTIAL_LENGTH) return false;
  // Always run the hash comparison so a wrong username costs the same as a wrong password.
  const passwordOk = await bcrypt.compare(password, cfg.adminPasswordHash);
  return username === cfg.adminUsername && passwordOk;
}
