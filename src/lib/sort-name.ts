import { sql, type SQL, type SQLWrapper } from "drizzle-orm";

/** Latin letters with accents and the letter they sort as. lower() only lowercases ASCII under collate "C", so the capitals are listed too. */
const ACCENT_GROUPS: [string, string][] = [
  ["a", "àáâãäåÀÁÂÃÄÅ"],
  ["c", "çÇ"],
  ["e", "èéêëÈÉÊË"],
  ["i", "ìíîïÌÍÎÏ"],
  ["n", "ñÑ"],
  ["o", "òóôõöÒÓÔÕÖ"],
  ["u", "ùúûüÙÚÛÜ"],
  ["y", "ýÿÝ"],
];
const ACCENTED = ACCENT_GROUPS.map(([, from]) => from).join("");
const BASE_LETTERS = ACCENT_GROUPS.map(([to, from]) => to.repeat(from.length)).join("");

/** Spec 16.6: the name without case, accents and leading punctuation or spaces, in code order. */
export function sortName(column: SQLWrapper): SQL {
  return sql`regexp_replace(translate(lower(${column}), ${ACCENTED}, ${BASE_LETTERS}), '^[^a-z0-9]+', '') collate "C"`;
}
