/**
 * YouTube utility functions for CallVault
 *
 * Provides duration parsing, number formatting, and category mapping
 * for YouTube video metadata display.
 *
 * @pattern youtube-utils
 */

/**
 * Parse YouTube ISO 8601 duration to seconds and human-readable display.
 *
 * YouTube Data API returns durations in ISO 8601 format like "PT1H2M10S".
 * This function converts them to total seconds and a display string.
 *
 * @param iso8601 - Duration in ISO 8601 format (e.g., "PT1H2M10S", "PT5M", "PT30S", "PT0S")
 * @returns Object with `seconds` (total) and `display` (human-readable like "1:02:10")
 *
 * @example
 * ```ts
 * parseYouTubeDuration("PT1H2M10S")  // { seconds: 3730, display: "1:02:10" }
 * parseYouTubeDuration("PT5M30S")    // { seconds: 330, display: "5:30" }
 * parseYouTubeDuration("PT30S")      // { seconds: 30, display: "0:30" }
 * parseYouTubeDuration("PT0S")       // { seconds: 0, display: "0:00" }
 * parseYouTubeDuration("invalid")    // { seconds: 0, display: "0:00" }
 * ```
 */
export function parseYouTubeDuration(iso8601: string): { seconds: number; display: string } {
  if (!iso8601 || typeof iso8601 !== 'string') {
    return { seconds: 0, display: '0:00' }
  }

  const match = iso8601.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) {
    return { seconds: 0, display: '0:00' }
  }

  const hours = parseInt(match[1] || '0', 10)
  const minutes = parseInt(match[2] || '0', 10)
  const secs = parseInt(match[3] || '0', 10)
  const totalSeconds = hours * 3600 + minutes * 60 + secs

  if (hours > 0) {
    return {
      seconds: totalSeconds,
      display: `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`,
    }
  }

  return {
    seconds: totalSeconds,
    display: `${minutes}:${String(secs).padStart(2, '0')}`,
  }
}

/**
 * Format large numbers compactly for display (e.g., view counts, like counts).
 *
 * @param num - Number to format
 * @returns Compact string representation
 *
 * @example
 * ```ts
 * formatCompactNumber(523)        // "523"
 * formatCompactNumber(1234)       // "1.2K"
 * formatCompactNumber(12345)      // "12.3K"
 * formatCompactNumber(123456)     // "123.5K"
 * formatCompactNumber(1234567)    // "1.2M"
 * formatCompactNumber(1234567890) // "1.2B"
 * ```
 */
export function formatCompactNumber(num: number): string {
  if (num < 0) return `-${formatCompactNumber(-num)}`
  if (num < 1000) return String(num)

  if (num < 1_000_000) {
    const value = num / 1000
    return value < 10
      ? `${value.toFixed(1)}K`
      : value < 100
        ? `${value.toFixed(1)}K`
        : `${value.toFixed(1)}K`
  }

  if (num < 1_000_000_000) {
    const value = num / 1_000_000
    return value < 10
      ? `${value.toFixed(1)}M`
      : value < 100
        ? `${value.toFixed(1)}M`
        : `${value.toFixed(1)}M`
  }

  const value = num / 1_000_000_000
  return value < 10
    ? `${value.toFixed(1)}B`
    : value < 100
      ? `${value.toFixed(1)}B`
      : `${value.toFixed(1)}B`
}

/**
 * Static mapping of YouTube category IDs to human-readable names.
 *
 * YouTube Data API returns categoryId as a string number.
 * These categories are stable and rarely change.
 *
 * @see https://developers.google.com/youtube/v3/docs/videoCategories/list
 */
export const YOUTUBE_CATEGORIES: Record<string, string> = {
  '1': 'Film & Animation',
  '2': 'Autos & Vehicles',
  '10': 'Music',
  '15': 'Pets & Animals',
  '17': 'Sports',
  '19': 'Travel & Events',
  '20': 'Gaming',
  '21': 'Videoblogging',
  '22': 'People & Blogs',
  '23': 'Comedy',
  '24': 'Entertainment',
  '25': 'News & Politics',
  '26': 'Howto & Style',
  '27': 'Education',
  '28': 'Science & Technology',
  '29': 'Nonprofits & Activism',
  '30': 'Movies',
  '43': 'Shows',
}
