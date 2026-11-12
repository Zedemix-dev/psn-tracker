/** `value` when it is one of `allowed`, otherwise `fallback`. */
export function pick<T extends string>(allowed: readonly T[], value: string | null, fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}
