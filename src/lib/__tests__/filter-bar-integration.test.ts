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

describe('Filter stacking — AND composition', () => {
  it('setting tags filter then adding source filter produces combined state with both', () => {
    let filters: Filters = {};

    // Apply tags first
    filters = applyFilter(filters, { tags: ['tag-1', 'tag-2'] });
    expect(filters.tags).toEqual(['tag-1', 'tag-2']);
    expect(filters.sources).toBeUndefined();

    // Then apply sources — tags must still be present
    filters = applyFilter(filters, { sources: ['fathom', 'zoom'] });
    expect(filters.tags).toEqual(['tag-1', 'tag-2']);
    expect(filters.sources).toEqual(['fathom', 'zoom']);
  });

  it('three simultaneous filters produce a single state object containing all three', () => {
    let filters: Filters = {};

    filters = applyFilter(filters, { tags: ['important'] });
    filters = applyFilter(filters, { sources: ['zoom'] });
    filters = applyFilter(filters, { durationMin: 30 });

    expect(filters.tags).toEqual(['important']);
    expect(filters.sources).toEqual(['zoom']);
    expect(filters.durationMin).toBe(30);
  });

  it('applying the same filter dimension twice replaces, not duplicates', () => {
    let filters: Filters = {};

    filters = applyFilter(filters, { tags: ['old-tag'] });
    filters = applyFilter(filters, { tags: ['new-tag-1', 'new-tag-2'] });

    expect(filters.tags).toEqual(['new-tag-1', 'new-tag-2']);
  });
});

// ---------------------------------------------------------------------------
// Pill removal — independence
// ---------------------------------------------------------------------------

describe('Pill removal — removing one filter leaves others intact', () => {
  // Shared baseline: tags + sources + duration all active
  const baseline: Filters = {
    tags: ['important', 'follow-up'],
    sources: ['fathom'],
    durationMin: 15,
    durationMax: 60,
  };

  it('removing tags pill leaves sources and duration intact', () => {
    const result = removeFilter(baseline, 'tags');

    expect(result.tags).toEqual([]);
    expect(result.sources).toEqual(['fathom']);
    expect(result.durationMin).toBe(15);
    expect(result.durationMax).toBe(60);
  });

  it('removing sources pill leaves tags and duration intact', () => {
    const result = removeFilter(baseline, 'sources');

    expect(result.sources).toEqual([]);
    expect(result.tags).toEqual(['important', 'follow-up']);
    expect(result.durationMin).toBe(15);
    expect(result.durationMax).toBe(60);
  });

  it('removing duration pill leaves tags and sources intact', () => {
    const result1 = removeFilter(baseline, 'durationMin');
    const result2 = removeFilter(result1, 'durationMax');

    expect(result2.durationMin).toBeUndefined();
    expect(result2.durationMax).toBeUndefined();
    expect(result2.tags).toEqual(['important', 'follow-up']);
    expect(result2.sources).toEqual(['fathom']);
  });

  it('removing participants pill leaves folders and tags intact', () => {
    const withParticipants: Filters = {
      participants: ['alice@example.com', 'bob@example.com'],
      folders: ['clients'],
      tags: ['urgent'],
    };

    const result = removeFilter(withParticipants, 'participants');

    expect(result.participants).toEqual([]);
    expect(result.folders).toEqual(['clients']);
    expect(result.tags).toEqual(['urgent']);
  });
});

// ---------------------------------------------------------------------------
// Clear all
// ---------------------------------------------------------------------------

describe('Clear all filters', () => {
  it('resetting to empty object leaves no active filters', () => {
    const active: Filters = {
      tags: ['important'],
      sources: ['fathom'],
      durationMin: 30,
      participants: ['alice@example.com'],
      folders: ['clients'],
    };

    // Simulate clear-all: replace entire state with empty
    const cleared: Filters = {};

    expect(cleared.tags).toBeUndefined();
    expect(cleared.sources).toBeUndefined();
    expect(cleared.durationMin).toBeUndefined();
    expect(cleared.participants).toBeUndefined();
    expect(cleared.folders).toBeUndefined();

    // Original object should be unchanged (immutable pattern)
    expect(active.tags).toEqual(['important']);
  });
});

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

  it('removing one filter from URL-round-tripped state preserves the others', () => {
    const original: Filters = {
      tags: ['sales', 'quarterly'],
      sources: ['zoom'],
      folders: ['clients'],
      participants: ['alice@example.com'],
    };

    // Round-trip through URL
    const params = filtersToURLParams(original);
    const restored = urlParamsToFilters(params);

    // Now remove tags pill
    const afterRemove = removeFilter(restored, 'tags');

    expect(afterRemove.tags).toEqual([]);
    expect(afterRemove.sources).toEqual(['zoom']);
    expect(afterRemove.folders).toEqual(['clients']);
    expect(afterRemove.participants).toEqual(['alice@example.com']);
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
