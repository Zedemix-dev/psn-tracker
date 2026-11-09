import { notFound } from "next/navigation";
import { ComingSoon } from "@/components/ComingSoon";

// A static sibling such as app/(site)/(banner)/settings/page.tsx takes precedence over this segment.
const SECTIONS: Record<string, string> = {
  "trophy-log": "Trophy Log",
  "trophy-advisor": "Trophy Advisor",
  stats: "Stats",
};

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const name = Object.hasOwn(SECTIONS, section) ? SECTIONS[section] : undefined;
  if (!name) notFound();
  return <ComingSoon name={name} />;
}
