/**
 * Tiny semver helpers used by extension/bridge version comparison.
 *
 * Compares only the major.minor.patch triple — pre-release tags and build
 * metadata are ignored. Non-numeric or missing parts coerce to 0, so values
 * like "1.2", "", null, and undefined all parse without throwing.
 */

/**
 * Parses a semver-ish string into a [major, minor, patch] tuple.
 * Missing or non-numeric parts become 0.
 */
export function parseSemver(
  value: string | null | undefined,
): [number, number, number] {
  const parts = (value ?? "").split(".").map((part) => Number.parseInt(part, 10));
  return [
    Number.isFinite(parts[0]) ? parts[0] : 0,
    Number.isFinite(parts[1]) ? parts[1] : 0,
    Number.isFinite(parts[2]) ? parts[2] : 0,
  ];
}

/**
 * Returns -1 if left < right, 1 if left > right, 0 if equal.
 * Compares major, then minor, then patch.
 */
export function compareSemver(
  left: string | null | undefined,
  right: string | null | undefined,
): number {
  const leftParts = parseSemver(left);
  const rightParts = parseSemver(right);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] > rightParts[index] ? 1 : -1;
    }
  }
  return 0;
}
