/**
 * Tag utility functions for normalization and autocomplete
 *
 * Handles tag normalization (lowercase, trim), deduplication, and autocomplete suggestions.
 */

/**
 * Normalizes a single tag by converting to lowercase and trimming whitespace.
 * Returns null for empty or invalid tags.
 *
 * @param tag - The tag to normalize
 * @returns The normalized tag or null if invalid
 */
export function normalizeTag(tag: string): string | null {
  if (typeof tag !== "string") {
    return null;
  }

  const normalized = tag.toLowerCase().trim();

  // Reject empty tags
  if (normalized.length === 0) {
    return null;
  }

  return normalized;
}

/**
 * Normalizes an array of tags - lowercase, trim, remove empty/invalid, and deduplicate.
 *
 * @param tags - Array of tags to normalize
 * @returns Array of unique, normalized tags
 */
export function normalizeTags(tags: string[]): string[] {
  if (!Array.isArray(tags)) {
    return [];
  }

  const normalizedSet = new Set<string>();

  for (const tag of tags) {
    const normalized = normalizeTag(tag);
    if (normalized !== null) {
      normalizedSet.add(normalized);
    }
  }

  return Array.from(normalizedSet);
}

/**
 * Removes duplicate tags from an array, preserving order.
 * Does NOT normalize - use normalizeTags() if normalization is also needed.
 *
 * @param tags - Array of tags that may contain duplicates
 * @returns Array of unique tags in original order
 */
export function deduplicateTags(tags: string[]): string[] {
  if (!Array.isArray(tags)) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const tag of tags) {
    if (!seen.has(tag)) {
      seen.add(tag);
      result.push(tag);
    }
  }

  return result;
}

/**
 * Validates a tag against naming rules.
 *
 * @param tag - The tag to validate (should be already normalized)
 * @returns True if the tag is valid
 */
export function isValidTag(tag: string): boolean {
  if (typeof tag !== "string" || tag.length === 0) {
    return false;
  }

  // Tags must not be empty after trimming
  if (tag.trim().length === 0) {
    return false;
  }

  // Tags should not be excessively long (max 50 characters)
  if (tag.length > 50) {
    return false;
  }

  return true;
}

/**
 * Filters tags based on a partial match for autocomplete suggestions.
 *
 * @param partial - The partial tag string to match against
 * @param existingTags - Array of existing tags to search through
 * @param options - Optional configuration
 * @returns Array of matching tags, sorted by relevance
 */
export function getTagSuggestions(
  partial: string,
  existingTags: string[],
  options: {
    /** Maximum number of suggestions to return */
    limit?: number;
    /** Whether to include exact match in results (default: false) */
    includeExact?: boolean;
  } = {}
): string[] {
  const { limit = 10, includeExact = false } = options;

  if (!Array.isArray(existingTags)) {
    return [];
  }

  const normalizedPartial = normalizeTag(partial);

  // Return empty array for empty search
  if (normalizedPartial === null) {
    return [];
  }

  // Normalize and deduplicate existing tags
  const uniqueTags = normalizeTags(existingTags);

  // Filter tags that start with or contain the partial string
  const matches = uniqueTags.filter((tag) => {
    const isExactMatch = tag === normalizedPartial;

    // Skip exact matches unless includeExact is true
    if (isExactMatch && !includeExact) {
      return false;
    }

    return tag.includes(normalizedPartial);
  });

  // Sort by relevance: prefix matches first, then by length
  matches.sort((a, b) => {
    const aStartsWith = a.startsWith(normalizedPartial);
    const bStartsWith = b.startsWith(normalizedPartial);

    // Prefix matches come first
    if (aStartsWith && !bStartsWith) return -1;
    if (!aStartsWith && bStartsWith) return 1;

    // Then sort by length (shorter tags first)
    return a.length - b.length;
  });

  return matches.slice(0, limit);
}

/**
 * Adds a new tag to an existing tag array, normalizing and deduplicating.
 *
 * @param existingTags - Current array of tags
 * @param newTag - Tag to add
 * @returns New array with the tag added (if valid and not duplicate)
 */
export function addTag(existingTags: string[], newTag: string): string[] {
  const normalized = normalizeTag(newTag);

  if (normalized === null) {
    return existingTags;
  }

  // Check if tag already exists (case-insensitive)
  const normalizedExisting = normalizeTags(existingTags);
  if (normalizedExisting.includes(normalized)) {
    return normalizedExisting;
  }

  return [...normalizedExisting, normalized];
}

/**
 * Removes a tag from an existing tag array.
 *
 * @param existingTags - Current array of tags
 * @param tagToRemove - Tag to remove
 * @returns New array with the tag removed
 */
export function removeTag(existingTags: string[], tagToRemove: string): string[] {
  const normalizedToRemove = normalizeTag(tagToRemove);

  if (normalizedToRemove === null) {
    return existingTags;
  }

  return existingTags.filter((tag) => {
    const normalizedTag = normalizeTag(tag);
    return normalizedTag !== normalizedToRemove;
  });
}

/**
 * Parses a comma-separated string of tags into an array.
 *
 * @param tagString - Comma-separated tags string
 * @returns Array of normalized, deduplicated tags
 */
export function parseTagString(tagString: string): string[] {
  if (typeof tagString !== "string") {
    return [];
  }

  const tags = tagString.split(",");
  return normalizeTags(tags);
}

/**
 * Converts a tag array to a comma-separated string.
 *
 * @param tags - Array of tags
 * @returns Comma-separated string of tags
 */
export function tagsToString(tags: string[]): string {
  if (!Array.isArray(tags)) {
    return "";
  }

  return normalizeTags(tags).join(", ");
}
