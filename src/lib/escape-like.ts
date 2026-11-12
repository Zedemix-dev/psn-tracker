/** Escapes the LIKE/ILIKE wildcards (and the escape character) so `s` matches literally. */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, "\\$&");
}
