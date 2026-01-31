# How CallVault Handles Duplicate Calls

When you connect multiple recording sources (Zoom, Google Meet, Fathom, etc.), CallVault automatically detects and merges duplicate recordings of the same meeting.

## Why Duplicates Happen

You might have the same call recorded in multiple places:
- Fathom recorded the call AND Zoom cloud recording was enabled
- You manually uploaded a recording that was already synced
- Multiple team members recorded the same meeting

Without deduplication, you'd see the same meeting multiple times in your library.

## How Detection Works

CallVault identifies duplicates by comparing:
- **Meeting title** (similar names indicate same meeting)
- **Time overlap** (recordings that cover the same time period)
- **Participants** (same people in the meeting)

Meetings are flagged as duplicates when they match on multiple criteria.

## What Happens to Duplicates

When duplicates are detected:
1. **One primary recording is kept visible** in your library
2. **Other versions are linked** to the primary
3. **You can still access all versions** if needed

### Which Version is Primary?

CallVault chooses the best version based on:
- **Longest transcript** - More content is better
- **Most recent sync** - Newer data may be more complete
- **Platform priority** - Some sources provide richer metadata

## Viewing All Versions

If you want to see all recordings of a meeting:
1. Open the call detail view
2. Look for "X linked recordings" indicator
3. Click to expand and see all versions
4. Switch primary version if preferred

## Manual Control

You can manually:
- **Unlink recordings** if they're not actually duplicates
- **Link recordings** that weren't auto-detected
- **Choose which version is primary**

## FAQ

**Q: Will I lose any data?**
A: No. All versions are preserved. Deduplication only controls which version appears in your main library.

**Q: Can I turn off deduplication?**
A: Currently, deduplication runs automatically. You can unlink any incorrectly merged recordings.

**Q: What if the wrong version is primary?**
A: Open call details and select your preferred version as primary.

**Q: How accurate is the detection?**
A: CallVault uses fuzzy matching to handle slight variations in titles and timing. It requires matches on multiple criteria to avoid false positives.

**Q: Does deduplication affect my search results?**
A: Yes, only primary recordings appear in search results by default. This keeps your results clean without showing the same meeting multiple times.

**Q: What about team recordings?**
A: Team deduplication works across all team members' recordings. If two team members recorded the same meeting, only one primary version appears in the team library.
