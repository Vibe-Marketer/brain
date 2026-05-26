import type { AvailableCall, ConnectorAdapter } from "./registry/types";

type SearchAvailable = NonNullable<ConnectorAdapter["searchAvailable"]>;

export function appendUniqueAvailableCalls(
  previous: AvailableCall[],
  next: AvailableCall[],
): AvailableCall[] {
  const seen = new Set(previous.map((item) => item.externalId));
  const uniqueNext = next.filter((item) => !seen.has(item.externalId));
  return [...previous, ...uniqueNext];
}

export async function searchAllAvailableConnectorCalls(params: {
  searchAvailable: SearchAvailable;
  sourceId: string;
  dateStart: Date;
  dateEnd: Date;
  cursor?: string;
  limit?: number;
  maxPages?: number;
}): Promise<AvailableCall[]> {
  const maxPages = params.maxPages ?? 10;
  let calls: AvailableCall[] = [];
  let cursor = params.cursor;

  for (let page = 0; page < maxPages; page += 1) {
    const result = await params.searchAvailable({
      sourceId: params.sourceId,
      dateStart: params.dateStart,
      dateEnd: params.dateEnd,
      cursor,
      limit: params.limit,
    });

    calls = appendUniqueAvailableCalls(calls, result.items);

    if (!result.nextCursor) break;
    cursor = result.nextCursor;
  }

  return calls;
}
