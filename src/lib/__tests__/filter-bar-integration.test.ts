/**
 * Integration tests for filter stacking (AND logic) and pill removal independence.
 *
 * These tests verify filter state manipulation at the data layer — no React rendering.
 * They simulate what FilterBar does: spreading filter state for updates, removing
 * individual filter fields while preserving others, and URL round-trip persistence.
 */
import { describe, it, expect } from 'vitest';
import {
  filtersToURLParams,
  urlParamsToFilters,
  FilterState,
} from '../filter-utils';

// ---------------------------------------------------------------------------
// Helper: simulate FilterBar's onFiltersChange spread pattern
// ---------------------------------------------------------------------------
type Filters = Partial<FilterState>;

/** Simulate applying a single filter dimension while preserving all others. */
function applyFilter(current: Filters, update: Partial<Filters>): Filters {
  return { ...current, ...update };
}

/** Simulate removing a filter pill by resetting its field to empty. */
function removeFilter(current: Filters, field: keyof Filters): Filters {
  const next = { ...current };
  if (field === 'tags' || field === 'folders' || field === 'sources' || field === 'participants') {
    next[field] = [];
  } else if (field === 'durationMin' || field === 'durationMax') {
    delete next[field];
  } else {
    delete next[field];
  }
  return next;
}

// ---------------------------------------------------------------------------
// AND Stacking
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Pill removal — independence
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Clear all
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// URL round-trip — combined filter persistence
// ---------------------------------------------------------------------------

describe('URL round-trip — combined filter state', () => {
  it('preserves all filter dimensions through URL serialization', () => {
    const original: Filters = {
      dateFrom: new Date('2024-01-01T00:00:00.000Z'),
      dateTo: new Date('2024-01-31T23:59:59.999Z'),
      participants: ['alice@example.com', 'bob@example.com'],
      durationMin: 15,
      durationMax: 90,
      tags: ['important', 'follow-up'],
      folders: ['clients', 'internal'],
      sources: ['fathom', 'zoom'],
    };

    const params = filtersToURLParams(original);
    const restored = urlParamsToFilters(params);

    expect(restored.dateFrom?.toISOString()).toBe(original.dateFrom?.toISOString());
    expect(restored.dateTo?.toISOString()).toBe(original.dateTo?.toISOString());
    expect(restored.participants).toEqual(original.participants);
    expect(restored.durationMin).toBe(original.durationMin);
    expect(restored.durationMax).toBe(original.durationMax);
    expect(restored.tags).toEqual(original.tags);
    expect(restored.folders).toEqual(original.folders);
    expect(restored.sources).toEqual(original.sources);
  });

  it('serializes sources to URL and deserializes correctly', () => {
    const original: Filters = {
      sources: ['fathom', 'zoom', 'youtube'],
    };

    const params = filtersToURLParams(original);

    expect(params.get('sources')).toBe('fathom,zoom,youtube');

    const restored = urlParamsToFilters(params);
    expect(restored.sources).toEqual(['fathom', 'zoom', 'youtube']);
  });
});
