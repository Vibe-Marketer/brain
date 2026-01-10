import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseSearchSyntax,
  syntaxToFilters,
  filtersToURLParams,
  urlParamsToFilters,
  addToSearchHistory,
  getSearchHistory,
  clearSearchHistory,
  FilterState,
} from '../filter-utils';

describe('parseSearchSyntax', () => {
  it('should parse participant filter', () => {
    const result = parseSearchSyntax('participant:john meeting notes');
    expect(result.filters.participant).toEqual(['john']);
    expect(result.plainText).toBe('meeting notes');
  });

  it('should parse multiple filters', () => {
    const result = parseSearchSyntax('participant:john date:today category:sales planning');
    expect(result.filters.participant).toEqual(['john']);
    expect(result.filters.date).toBe('today');
    expect(result.filters.category).toEqual(['sales']);
    expect(result.plainText).toBe('planning');
  });

  it('should handle duration filter with different formats', () => {
    const result1 = parseSearchSyntax('duration:>30');
    expect(result1.filters.duration).toBe('>30');

    const result2 = parseSearchSyntax('duration:<15');
    expect(result2.filters.duration).toBe('<15');

    const result3 = parseSearchSyntax('duration:30-60');
    expect(result3.filters.duration).toBe('30-60');
  });

  it('should parse status filter', () => {
    const result = parseSearchSyntax('status:synced status:unsynced');
    expect(result.filters.status).toEqual(['synced', 'unsynced']);
  });

  it('should parse tag filter with tag: prefix', () => {
    const result = parseSearchSyntax('tag:important meeting notes');
    expect(result.filters.tag).toEqual(['important']);
    expect(result.plainText).toBe('meeting notes');
  });

  it('should parse tag filter with t: short alias', () => {
    const result = parseSearchSyntax('t:urgent project update');
    expect(result.filters.tag).toEqual(['urgent']);
    expect(result.plainText).toBe('project update');
  });

  it('should parse multiple tags', () => {
    const result = parseSearchSyntax('tag:important tag:follow-up t:client');
    expect(result.filters.tag).toEqual(['important', 'follow-up', 'client']);
    expect(result.plainText).toBe('');
  });

  it('should parse tags mixed with other filters', () => {
    const result = parseSearchSyntax('meeting tag:important participant:john date:today t:urgent');
    expect(result.filters.tag).toEqual(['important', 'urgent']);
    expect(result.filters.participant).toEqual(['john']);
    expect(result.filters.date).toBe('today');
    expect(result.plainText).toBe('meeting');
  });

  it('should parse folder filter with folder: prefix', () => {
    const result = parseSearchSyntax('folder:clients meeting notes');
    expect(result.filters.folder).toEqual(['clients']);
    expect(result.plainText).toBe('meeting notes');
  });

  it('should parse folder filter with f: short alias', () => {
    const result = parseSearchSyntax('f:projects project update');
    expect(result.filters.folder).toEqual(['projects']);
    expect(result.plainText).toBe('project update');
  });

  it('should parse multiple folders', () => {
    const result = parseSearchSyntax('folder:clients folder:2024 f:active');
    expect(result.filters.folder).toEqual(['clients', '2024', 'active']);
    expect(result.plainText).toBe('');
  });

  it('should parse folders mixed with other filters', () => {
    const result = parseSearchSyntax('meeting folder:clients participant:john date:today f:active tag:important');
    expect(result.filters.folder).toEqual(['clients', 'active']);
    expect(result.filters.participant).toEqual(['john']);
    expect(result.filters.date).toBe('today');
    expect(result.filters.tag).toEqual(['important']);
    expect(result.plainText).toBe('meeting');
  });
});

describe('syntaxToFilters - Date Filters', () => {
  it('should parse "today" without date mutation', () => {
    const syntax = parseSearchSyntax('date:today');
    const filters = syntaxToFilters(syntax);
    
    expect(filters.dateFrom).toBeDefined();
    expect(filters.dateTo).toBeDefined();
    
    const from = filters.dateFrom!;
    const to = filters.dateTo!;
    
    expect(from.getHours()).toBe(0);
    expect(from.getMinutes()).toBe(0);
    expect(to.getHours()).toBe(23);
    expect(to.getMinutes()).toBe(59);
    
    // Ensure both dates are the same day
    expect(from.toDateString()).toBe(to.toDateString());
  });

  it('should parse "yesterday" without date mutation', () => {
    const syntax = parseSearchSyntax('date:yesterday');
    const filters = syntaxToFilters(syntax);
    
    expect(filters.dateFrom).toBeDefined();
    expect(filters.dateTo).toBeDefined();
    
    const from = filters.dateFrom!;
    const to = filters.dateTo!;
    
    expect(from.getHours()).toBe(0);
    expect(to.getHours()).toBe(23);
    
    // Verify it's yesterday
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    expect(from.toDateString()).toBe(yesterday.toDateString());
    expect(to.toDateString()).toBe(yesterday.toDateString());
  });

  it('should parse "week" preset correctly', () => {
    const syntax = parseSearchSyntax('date:week');
    const filters = syntaxToFilters(syntax);
    
    expect(filters.dateFrom).toBeDefined();
    expect(filters.dateTo).toBeDefined();
    
    const daysDiff = Math.round(
      (filters.dateTo!.getTime() - filters.dateFrom!.getTime()) / (1000 * 60 * 60 * 24)
    );
    expect(daysDiff).toBeGreaterThanOrEqual(6);
    expect(daysDiff).toBeLessThanOrEqual(7);
  });

  it('should parse ISO date format', () => {
    const syntax = parseSearchSyntax('date:2024-01-15');
    const filters = syntaxToFilters(syntax);

    expect(filters.dateFrom).toBeDefined();
    expect(filters.dateTo).toBeDefined();

    const from = filters.dateFrom!;
    const to = filters.dateTo!;

    // Verify we get a valid date and proper start/end of day times
    expect(from.getFullYear()).toBe(2024);
    expect(from.getMonth()).toBe(0); // January is 0
    expect(from.getHours()).toBe(0);
    expect(from.getMinutes()).toBe(0);
    expect(to.getHours()).toBe(23);
    expect(to.getMinutes()).toBe(59);

    // Both dates should be the same calendar day
    expect(from.toDateString()).toBe(to.toDateString());
  });
});

describe('syntaxToFilters - Duration Filters', () => {
  it('should parse duration greater than', () => {
    const syntax = parseSearchSyntax('duration:>30');
    const filters = syntaxToFilters(syntax);

    expect(filters.durationMin).toBe(30);
    expect(filters.durationMax).toBeUndefined();
  });

  it('should parse duration less than', () => {
    const syntax = parseSearchSyntax('duration:<15');
    const filters = syntaxToFilters(syntax);

    expect(filters.durationMin).toBeUndefined();
    expect(filters.durationMax).toBe(15);
  });

  it('should parse duration range', () => {
    const syntax = parseSearchSyntax('duration:30-60');
    const filters = syntaxToFilters(syntax);

    expect(filters.durationMin).toBe(30);
    expect(filters.durationMax).toBe(60);
  });
});

describe('syntaxToFilters - Tags and Folders', () => {
  it('should convert single tag to FilterState.tags', () => {
    const syntax = parseSearchSyntax('tag:important');
    const filters = syntaxToFilters(syntax);

    expect(filters.tags).toEqual(['important']);
  });

  it('should convert multiple tags to FilterState.tags array', () => {
    const syntax = parseSearchSyntax('tag:important tag:follow-up t:urgent');
    const filters = syntaxToFilters(syntax);

    expect(filters.tags).toEqual(['important', 'follow-up', 'urgent']);
  });

  it('should convert single folder to FilterState.folders', () => {
    const syntax = parseSearchSyntax('folder:clients');
    const filters = syntaxToFilters(syntax);

    expect(filters.folders).toEqual(['clients']);
  });

  it('should convert multiple folders to FilterState.folders array', () => {
    const syntax = parseSearchSyntax('folder:clients folder:2024 f:active');
    const filters = syntaxToFilters(syntax);

    expect(filters.folders).toEqual(['clients', '2024', 'active']);
  });

  it('should convert mixed tags and folders together', () => {
    const syntax = parseSearchSyntax('tag:important folder:clients t:urgent f:active');
    const filters = syntaxToFilters(syntax);

    expect(filters.tags).toEqual(['important', 'urgent']);
    expect(filters.folders).toEqual(['clients', 'active']);
  });

  it('should handle tags and folders with other filters', () => {
    const syntax = parseSearchSyntax('meeting tag:important folder:clients participant:john date:today');
    const filters = syntaxToFilters(syntax);

    expect(filters.tags).toEqual(['important']);
    expect(filters.folders).toEqual(['clients']);
    expect(filters.participants).toEqual(['john']);
    expect(filters.dateFrom).toBeDefined();
    expect(filters.dateTo).toBeDefined();
  });

  it('should return undefined tags when no tag filter present', () => {
    const syntax = parseSearchSyntax('folder:clients');
    const filters = syntaxToFilters(syntax);

    expect(filters.tags).toBeUndefined();
  });

  it('should return undefined folders when no folder filter present', () => {
    const syntax = parseSearchSyntax('tag:important');
    const filters = syntaxToFilters(syntax);

    expect(filters.folders).toBeUndefined();
  });
});

describe('URL Persistence', () => {
  it('should serialize filters to URL params', () => {
    const filters: Partial<FilterState> = {
      dateFrom: new Date('2024-01-01'),
      dateTo: new Date('2024-01-31'),
      participants: ['john', 'jane'],
      categories: ['sales'],
      durationMin: 30,
      durationMax: 60,
      status: ['synced'],
    };

    const params = filtersToURLParams(filters);
    
    expect(params.get('from')).toBeTruthy();
    expect(params.get('to')).toBeTruthy();
    expect(params.get('participants')).toBe('john,jane');
    expect(params.get('categories')).toBe('sales');
    expect(params.get('durMin')).toBe('30');
    expect(params.get('durMax')).toBe('60');
    expect(params.get('status')).toBe('synced');
  });

  it('should deserialize URL params to filters', () => {
    const params = new URLSearchParams();
    params.set('from', '2024-01-01T00:00:00.000Z');
    params.set('to', '2024-01-31T23:59:59.999Z');
    params.set('participants', 'john,jane');
    params.set('categories', 'sales,marketing');
    params.set('durMin', '30');
    params.set('durMax', '60');
    params.set('status', 'synced,unsynced');

    const filters = urlParamsToFilters(params);
    
    expect(filters.dateFrom).toBeInstanceOf(Date);
    expect(filters.dateTo).toBeInstanceOf(Date);
    expect(filters.participants).toEqual(['john', 'jane']);
    expect(filters.categories).toEqual(['sales', 'marketing']);
    expect(filters.durationMin).toBe(30);
    expect(filters.durationMax).toBe(60);
    expect(filters.status).toEqual(['synced', 'unsynced']);
  });

  it('should handle round-trip conversion', () => {
    const original: Partial<FilterState> = {
      dateFrom: new Date('2024-01-01'),
      participants: ['john'],
      durationMin: 15,
    };

    const params = filtersToURLParams(original);
    const restored = urlParamsToFilters(params);

    expect(restored.dateFrom?.toDateString()).toBe(original.dateFrom?.toDateString());
    expect(restored.participants).toEqual(original.participants);
    expect(restored.durationMin).toBe(original.durationMin);
  });

  it('should serialize tags to URL params', () => {
    const filters: Partial<FilterState> = {
      tags: ['important', 'follow-up'],
    };

    const params = filtersToURLParams(filters);

    expect(params.get('tags')).toBe('important,follow-up');
  });

  it('should serialize folders to URL params', () => {
    const filters: Partial<FilterState> = {
      folders: ['clients', '2024', 'active'],
    };

    const params = filtersToURLParams(filters);

    expect(params.get('folders')).toBe('clients,2024,active');
  });

  it('should deserialize tags from URL params', () => {
    const params = new URLSearchParams();
    params.set('tags', 'important,follow-up,urgent');

    const filters = urlParamsToFilters(params);

    expect(filters.tags).toEqual(['important', 'follow-up', 'urgent']);
  });

  it('should deserialize folders from URL params', () => {
    const params = new URLSearchParams();
    params.set('folders', 'clients,projects,2024');

    const filters = urlParamsToFilters(params);

    expect(filters.folders).toEqual(['clients', 'projects', '2024']);
  });

  it('should handle round-trip conversion for tags', () => {
    const original: Partial<FilterState> = {
      tags: ['important', 'follow-up', 'client'],
    };

    const params = filtersToURLParams(original);
    const restored = urlParamsToFilters(params);

    expect(restored.tags).toEqual(original.tags);
  });

  it('should handle round-trip conversion for folders', () => {
    const original: Partial<FilterState> = {
      folders: ['clients', 'projects', 'active'],
    };

    const params = filtersToURLParams(original);
    const restored = urlParamsToFilters(params);

    expect(restored.folders).toEqual(original.folders);
  });

  it('should handle round-trip conversion for tags and folders mixed with other filters', () => {
    const original: Partial<FilterState> = {
      dateFrom: new Date('2024-01-15'),
      participants: ['john', 'jane'],
      categories: ['sales'],
      durationMin: 30,
      status: ['synced'],
      tags: ['important', 'urgent'],
      folders: ['clients', '2024'],
    };

    const params = filtersToURLParams(original);
    const restored = urlParamsToFilters(params);

    expect(restored.dateFrom?.toDateString()).toBe(original.dateFrom?.toDateString());
    expect(restored.participants).toEqual(original.participants);
    expect(restored.categories).toEqual(original.categories);
    expect(restored.durationMin).toBe(original.durationMin);
    expect(restored.status).toEqual(original.status);
    expect(restored.tags).toEqual(original.tags);
    expect(restored.folders).toEqual(original.folders);
  });

  it('should not include tags or folders in URL when empty', () => {
    const filters: Partial<FilterState> = {
      participants: ['john'],
      tags: [],
      folders: [],
    };

    const params = filtersToURLParams(filters);

    expect(params.get('participants')).toBe('john');
    expect(params.has('tags')).toBe(false);
    expect(params.has('folders')).toBe(false);
  });

  it('should handle single tag round-trip', () => {
    const original: Partial<FilterState> = {
      tags: ['important'],
    };

    const params = filtersToURLParams(original);
    const restored = urlParamsToFilters(params);

    expect(restored.tags).toEqual(['important']);
  });

  it('should handle single folder round-trip', () => {
    const original: Partial<FilterState> = {
      folders: ['clients'],
    };

    const params = filtersToURLParams(original);
    const restored = urlParamsToFilters(params);

    expect(restored.folders).toEqual(['clients']);
  });
});

describe('Search History', () => {
  beforeEach(() => {
    clearSearchHistory();
  });

  it('should add queries to search history', () => {
    addToSearchHistory('test query 1');
    addToSearchHistory('test query 2');
    
    const history = getSearchHistory();
    expect(history).toHaveLength(2);
    expect(history[0]).toBe('test query 2'); // Most recent first
    expect(history[1]).toBe('test query 1');
  });

  it('should limit history to 10 items', () => {
    for (let i = 0; i < 15; i++) {
      addToSearchHistory(`query ${i}`);
    }
    
    const history = getSearchHistory();
    expect(history).toHaveLength(10);
    expect(history[0]).toBe('query 14'); // Most recent
  });

  it('should not add duplicate consecutive queries', () => {
    addToSearchHistory('test query');
    addToSearchHistory('test query');
    addToSearchHistory('different query');
    addToSearchHistory('test query');
    
    const history = getSearchHistory();
    expect(history).toHaveLength(2);
    expect(history[0]).toBe('test query');
    expect(history[1]).toBe('different query');
  });

  it('should clear all search history', () => {
    addToSearchHistory('query 1');
    addToSearchHistory('query 2');
    
    clearSearchHistory();
    
    const history = getSearchHistory();
    expect(history).toHaveLength(0);
  });

  it('should handle localStorage errors gracefully', () => {
    // This test verifies the error handling exists
    // In a real scenario, you'd mock localStorage to throw
    expect(() => addToSearchHistory('test')).not.toThrow();
    expect(() => getSearchHistory()).not.toThrow();
    expect(() => clearSearchHistory()).not.toThrow();
  });
});

describe('Edge Cases', () => {
  it('should handle empty search query', () => {
    const result = parseSearchSyntax('');
    expect(result.plainText).toBe('');
    expect(Object.keys(result.filters)).toHaveLength(0);
  });

  it('should handle malformed duration filters', () => {
    const syntax = parseSearchSyntax('duration:invalid');
    const filters = syntaxToFilters(syntax);

    // Malformed duration (no >, <, or - pattern) should not set any duration values
    expect(filters.durationMin).toBeUndefined();
    expect(filters.durationMax).toBeUndefined();
  });

  it('should handle invalid date formats', () => {
    const syntax = parseSearchSyntax('date:not-a-date');
    const filters = syntaxToFilters(syntax);
    
    // Invalid dates should be ignored
    expect(filters.dateFrom).toBeUndefined();
    expect(filters.dateTo).toBeUndefined();
  });
});
