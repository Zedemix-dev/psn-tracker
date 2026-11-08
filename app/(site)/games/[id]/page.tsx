import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { requireSession } from "@/src/auth/require-session";
import { getDb } from "@/src/db/client";
import { titles } from "@/src/db/schema";

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const db = await getDb();
  const [title] = await db
    .select({ name: titles.name })
    .from(titles)
    .where(eq(titles.npCommunicationId, id));
  if (!title) notFound();
  return (
    <main className="wrap coming-soon">
      <h1>{title.name}</h1>
      <p>The game page is coming soon.</p>
    </main>
  );
}
