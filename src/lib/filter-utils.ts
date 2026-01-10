/**
 * Filter utilities for parsing search syntax and managing filter state
 */

export interface FilterState {
  dateFrom?: Date;
  dateTo?: Date;
  participants: string[];
  categories: string[];
  durationMin?: number;
  durationMax?: number;
  status: string[];
  tags?: string[];
  folders?: string[];
}

export interface SearchSyntax {
  plainText: string;
  filters: {
    participant?: string[];
    date?: string;
    category?: string[];
    duration?: string;
    status?: string[];
    tag?: string[];
    folder?: string[];
  };
}

/**
 * Parse search query for syntax like:
 * - participant:john
 * - date:today | date:yesterday | date:week | date:2024-01-01
 * - category:sales
 * - duration:>30 | duration:<15 | duration:30-60
 * - status:synced | status:unsynced
 */
export function parseSearchSyntax(query: string): SearchSyntax {
  const result: SearchSyntax = {
    plainText: '',
    filters: {},
  };

  const parts = query.split(/\s+/);
  const plainTextParts: string[] = [];

  for (const part of parts) {
    const colonIndex = part.indexOf(':');
    
    if (colonIndex > 0) {
      const key = part.substring(0, colonIndex).toLowerCase();
      const value = part.substring(colonIndex + 1);

      switch (key) {
        case 'participant':
        case 'p':
          if (!result.filters.participant) result.filters.participant = [];
          result.filters.participant.push(value);
          break;
        case 'date':
        case 'd':
          result.filters.date = value;
          break;
        case 'category':
        case 'cat':
        case 'c':
          if (!result.filters.category) result.filters.category = [];
          result.filters.category.push(value);
          break;
        case 'duration':
        case 'dur':
          result.filters.duration = value;
          break;
        case 'status':
        case 's':
          if (!result.filters.status) result.filters.status = [];
          result.filters.status.push(value);
          break;
        case 'tag':
        case 't':
          if (!result.filters.tag) result.filters.tag = [];
          result.filters.tag.push(value);
          break;
        case 'folder':
        case 'f':
          if (!result.filters.folder) result.filters.folder = [];
          result.filters.folder.push(value);
          break;
        default:
          plainTextParts.push(part);
      }
    } else {
      plainTextParts.push(part);
    }
  }

  result.plainText = plainTextParts.join(' ').trim();
  return result;
}

/**
 * Convert parsed syntax to FilterState
 */
export function syntaxToFilters(syntax: SearchSyntax): Partial<FilterState> {
  const filters: Partial<FilterState> = {};

  // Parse date filter
  if (syntax.filters.date) {
    const dateValue = syntax.filters.date.toLowerCase();
    const now = new Date();
    
    if (dateValue === 'today') {
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date(now);
      endOfToday.setHours(23, 59, 59, 999);
      filters.dateFrom = startOfToday;
      filters.dateTo = endOfToday;
    } else if (dateValue === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const startOfYesterday = new Date(yesterday);
      startOfYesterday.setHours(0, 0, 0, 0);
      const endOfYesterday = new Date(yesterday);
      endOfYesterday.setHours(23, 59, 59, 999);
      filters.dateFrom = startOfYesterday;
      filters.dateTo = endOfYesterday;
    } else if (dateValue === 'week') {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      filters.dateFrom = weekAgo;
      filters.dateTo = new Date();
    } else {
      // Try to parse as ISO date
      try {
        const parsed = new Date(dateValue);
        if (!isNaN(parsed.getTime())) {
          filters.dateFrom = new Date(parsed.setHours(0, 0, 0, 0));
          filters.dateTo = new Date(parsed.setHours(23, 59, 59, 999));
        }
      } catch {
        // Invalid date, ignore
      }
    }
  }

  // Parse duration filter
  if (syntax.filters.duration) {
    const dur = syntax.filters.duration;
    if (dur.startsWith('>')) {
      filters.durationMin = parseInt(dur.substring(1));
    } else if (dur.startsWith('<')) {
      filters.durationMax = parseInt(dur.substring(1));
    } else if (dur.includes('-')) {
      const [min, max] = dur.split('-').map(s => parseInt(s));
      filters.durationMin = min;
      filters.durationMax = max;
    }
  }

  // Set participants, categories, status, tags directly
  if (syntax.filters.participant) {
    filters.participants = syntax.filters.participant;
  }
  if (syntax.filters.category) {
    filters.categories = syntax.filters.category;
  }
  if (syntax.filters.status) {
    filters.status = syntax.filters.status;
  }
  if (syntax.filters.tag) {
    filters.tags = syntax.filters.tag;
  }
  if (syntax.filters.folder) {
    filters.folders = syntax.filters.folder;
  }

  return filters;
}

/**
 * Convert FilterState to URL search params
 */
export function filtersToURLParams(filters: Partial<FilterState>): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.dateFrom) {
    params.set('from', filters.dateFrom.toISOString());
  }
  if (filters.dateTo) {
    params.set('to', filters.dateTo.toISOString());
  }
  if (filters.participants && filters.participants.length > 0) {
    params.set('participants', filters.participants.join(','));
  }
  if (filters.categories && filters.categories.length > 0) {
    params.set('categories', filters.categories.join(','));
  }
  if (filters.durationMin !== undefined) {
    params.set('durMin', filters.durationMin.toString());
  }
  if (filters.durationMax !== undefined) {
    params.set('durMax', filters.durationMax.toString());
  }
  if (filters.status && filters.status.length > 0) {
    params.set('status', filters.status.join(','));
  }
  if (filters.tags && filters.tags.length > 0) {
    params.set('tags', filters.tags.join(','));
  }
  if (filters.folders && filters.folders.length > 0) {
    params.set('folders', filters.folders.join(','));
  }

  return params;
}

/**
 * Parse URL search params to FilterState
 */
export function urlParamsToFilters(params: URLSearchParams): Partial<FilterState> {
  const filters: Partial<FilterState> = {};

  const from = params.get('from');
  const to = params.get('to');
  const participants = params.get('participants');
  const categories = params.get('categories');
  const durMin = params.get('durMin');
  const durMax = params.get('durMax');
  const status = params.get('status');
  const tags = params.get('tags');
  const folders = params.get('folders');

  if (from) filters.dateFrom = new Date(from);
  if (to) filters.dateTo = new Date(to);
  if (participants) filters.participants = participants.split(',');
  if (categories) filters.categories = categories.split(',');
  if (durMin) filters.durationMin = parseInt(durMin);
  if (durMax) filters.durationMax = parseInt(durMax);
  if (status) filters.status = status.split(',');
  if (tags) filters.tags = tags.split(',');
  if (folders) filters.folders = folders.split(',');

  return filters;
}

/**
 * Get search history from localStorage
 */
export function getSearchHistory(): string[] {
  try {
    const history = localStorage.getItem('transcript-search-history');
    return history ? JSON.parse(history) : [];
  } catch {
    return [];
  }
}

/**
 * Add to search history (max 10 items)
 */
export function addToSearchHistory(query: string) {
  if (!query.trim()) return;
  
  try {
    let history = getSearchHistory();
    history = [query, ...history.filter(h => h !== query)].slice(0, 10);
    localStorage.setItem('transcript-search-history', JSON.stringify(history));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Clear search history
 */
export function clearSearchHistory() {
  try {
    localStorage.removeItem('transcript-search-history');
  } catch {
    // Ignore
  }
}
