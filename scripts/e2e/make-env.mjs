// Local end-to-end setup: writes .data/e2e.env (git-ignored) with a fresh test login.
// The login is local only: it is NOT the real site's password. Run once per PC.
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import bcrypt from "bcryptjs";

const target = ".data/e2e.env";
if (existsSync(target)) {
  console.log(`${target} already exists: delete it first to make a new one.`);
  process.exit(0);
}
const password = randomBytes(12).toString("base64url");
const lines = [
  "# Local end-to-end config (git-ignored). Test login only, not a real password.",
  `# Login: admin / ${password}`,
  "DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/postgres?max=1",
  "ADMIN_USERNAME=admin",
  `ADMIN_PASSWORD_HASH=${bcrypt.hashSync(password, 12)}`,
  `APP_SECRET=${randomBytes(32).toString("base64")}`,
  "PSN_LANGUAGE=en-GB",
  "MEDIA_DIR=./.data/e2e-media",
  "TZ=Europe/Paris",
  "",
];
mkdirSync(".data", { recursive: true });
writeFileSync(target, lines.join("\n"));
console.log(`Wrote ${target}. The test login is on its second line.`);
