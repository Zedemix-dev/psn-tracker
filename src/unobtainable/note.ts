export type NoteSegment = { text: string; href?: string };

const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;

function isWebAddress(address: string): boolean {
  try {
    const { protocol } = new URL(address);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Splits a list note into plain text and Markdown links. Only `[label](url)`
 * is interpreted; a link whose address is not http(s) keeps just its label.
 */
export function parseNote(note: string | null): NoteSegment[] {
  if (!note) return [];
  const segments: NoteSegment[] = [];
  let last = 0;
  for (const match of note.matchAll(LINK)) {
    const [whole, label, address] = match;
    if (match.index > last) segments.push({ text: note.slice(last, match.index) });
    segments.push(
      isWebAddress(address) ? { text: label, href: address } : { text: label },
    );
    last = match.index + whole.length;
  }
  if (last < note.length) segments.push({ text: note.slice(last) });
  return segments;
}

/** The note as plain text (link labels only), or null when there is none. */
export function notePlainText(note: string | null): string | null {
  const text = parseNote(note)
    .map((s) => s.text)
    .join("");
  return text === "" ? null : text;
}
