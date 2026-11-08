// Local end-to-end helper: run the SQL statements given as arguments against the e2e database.
import postgres from "postgres";
process.loadEnvFile(".data/e2e.env");
const sql = postgres(process.env.DATABASE_URL);
try {
  for (const stmt of process.argv.slice(2)) console.log(stmt, "->", JSON.stringify(await sql.unsafe(stmt)));
} finally {
  await sql.end();
}
