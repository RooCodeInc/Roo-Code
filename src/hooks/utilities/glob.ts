/**
 * Minimal glob matcher supporting "*" and "**" segments.
 * - "**" matches any nested path segments
 * - "*" matches within a segment
 */
export function globMatch(path: string, pattern: string): boolean {
  // Normalize to posix
  const normalize = (s: string) => s.replace(/\\/g, "/")
  const p = normalize(path)
  const pat = normalize(pattern)

  // Escape regex special chars except *
  const esc = pat.replace(/[.+?^${}()|\[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "__GLOBSTAR__")
    .replace(/\*/g, "[^/]*")
    .replace(/__GLOBSTAR__/g, ".*")

  const re = new RegExp(`^${esc}$`)
  return re.test(p)
}
