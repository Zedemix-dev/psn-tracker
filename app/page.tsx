import { requireSession } from "@/src/auth/require-session";

export default async function Home() {
  await requireSession();
  return (
    <main className="wrap">
      <h1>PSN Tracker</h1>
    </main>
  );
}
