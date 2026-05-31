import { supabase } from "@/integrations/supabase/client";
import { getSafeUser } from "@/lib/auth-utils";
import type {
  AvailableCall,
  ConnectorAdapter,
  ImportJob,
  SaveApiKeyCredentialsParams,
  SaveCredentialResult,
  ConnectorSourceApp,
} from "../types";

export async function disconnectConnectorSource({
  sourceApp,
  sourceId,
}: {
  sourceApp: ConnectorSourceApp;
  sourceId?: string | null;
}): Promise<void> {
  const { user, error: authError } = await getSafeUser();
  if (authError || !user) throw new Error("Not authenticated");

  const { error } = await supabase.rpc("disconnect_connector_source", {
    p_source_app: sourceApp,
    p_source_id: sourceId ?? null,
  });
  if (error) throw new Error(error.message);
}


type OAuthGetter = NonNullable<ConnectorAdapter["getOAuthAuthUrl"]>;
type CredentialSaver = NonNullable<ConnectorAdapter["saveApiKeyCredentials"]>;
type SearchAvailable = NonNullable<ConnectorAdapter["searchAvailable"]>;
type ImportSelected = NonNullable<ConnectorAdapter["importSelected"]>;

type EdgeFunctionPayload = Record<string, unknown> | undefined;

interface EdgeInvokeOptions {
  body?: EdgeFunctionPayload;
}

export async function invokeConnectorFunction<T>(
  functionName: string,
  options?: EdgeInvokeOptions,
): Promise<T> {
  const { data, error } =
    options && "body" in options
      ? await supabase.functions.invoke(functionName, { body: options.body })
      : await supabase.functions.invoke(functionName);

  if (error) throw new Error(await getFunctionErrorMessage(error));
  if ((data as { error?: string } | null)?.error) {
    throw new Error((data as { error: string }).error);
  }

  return data as T;
}

export function createOAuthUrlGetter(functionName: string): OAuthGetter {
  return async (params) => {
    const body =
      params?.sourceId || params?.workspaceId
        ? {
            ...(params.sourceId ? { sourceId: params.sourceId } : {}),
            ...(params.workspaceId
              ? { workspaceId: params.workspaceId, workspace_id: params.workspaceId }
              : {}),
          }
        : undefined;
    const data = await invokeConnectorFunction<{
      authUrl?: string;
      sourceId?: string;
      state?: string;
    } | null>(
      functionName,
      body ? { body } : undefined,
    );

    if (!data?.authUrl) {
      throw new Error(`${functionName} returned no authUrl`);
    }

    return {
      authUrl: data.authUrl,
      sourceId: data.sourceId,
      state: data.state,
    };
  };
}

export function createTokenCredentialSaver(
  functionName: string,
): CredentialSaver {
  return async ({ apiKey, sourceId, workspaceId }: SaveApiKeyCredentialsParams) => {
    const data = await invokeConnectorFunction<{
      sourceId?: string;
      source?: { id?: string };
    } | null>(functionName, {
      body: {
        accessToken: apiKey.trim(),
        ...(sourceId ? { sourceId } : {}),
        ...(workspaceId
          ? { workspaceId, workspace_id: workspaceId }
          : {}),
      },
    });

    const savedSourceId = data?.sourceId ?? data?.source?.id;
    if (!savedSourceId) {
      throw new Error(`${functionName} returned no sourceId`);
    }

    return { sourceId: savedSourceId } satisfies SaveCredentialResult;
  };
}

export function createDateRangeSearch<TItem>(config: {
  functionName: string;
  resultKey: "meetings" | "recordings";
  defaultLimit?: number;
  buildBody?: (params: Parameters<SearchAvailable>[0]) => Record<string, unknown>;
  nextCursor?: (response: Record<string, unknown>) => string | null | undefined;
  mapItem: (item: TItem) => AvailableCall;
}): SearchAvailable {
  return async (params) => {
    const body =
      config.buildBody?.(params) ?? {
        sourceId: params.sourceId,
        createdAfter: params.dateStart.toISOString(),
        createdBefore: params.dateEnd.toISOString(),
        cursor: params.cursor ?? null,
        limit: params.limit ?? config.defaultLimit ?? 50,
      };

    const response = await invokeConnectorFunction<Record<string, unknown> | null>(
      config.functionName,
      { body },
    );
    const items = response?.[config.resultKey];

    if (!Array.isArray(items)) {
      throw new Error(
        `${config.functionName} returned an invalid ${config.resultKey} payload`,
      );
    }

    return {
      items: (items as TItem[]).map(config.mapItem),
      nextCursor:
        config.nextCursor?.(response ?? {}) ??
        normalizeCursor((response?.nextCursor as unknown) ?? null),
    };
  };
}

export function createSelectedImporter(config: {
  functionName: string;
  idsField: string;
  messageLabel: string;
  messageNoun: string;
  buildMessage?: (args: { count: number }) => string;
  normalizeIds?: (externalIds: string[]) => unknown[];
  buildBody?: (params: Parameters<ImportSelected>[0], ids: unknown[]) => Record<string, unknown>;
}): ImportSelected {
  return async (params) => {
    const ids = config.normalizeIds?.(params.externalIds) ?? params.externalIds;
    const body =
      config.buildBody?.(params, ids) ?? {
        sourceId: params.sourceId,
        workspaceId: params.workspaceId,
        workspace_id: params.workspaceId,
        [config.idsField]: ids,
      };

    const data = await invokeConnectorFunction<{
      jobId?: string;
      job_id?: string;
    } | null>(config.functionName, { body });
    const jobId = data?.jobId ?? data?.job_id;

    if (!jobId) {
      throw new Error(`${config.functionName} returned no jobId`);
    }

    return {
      jobId,
      total: ids.length,
      message:
        config.buildMessage?.({ count: ids.length }) ??
        `Importing ${ids.length} ${config.messageLabel} ${config.messageNoun}(s)...`,
    } satisfies ImportJob;
  };
}

export function wasAlreadySynced(value: { synced: boolean }): boolean {
  return value.synced;
}

function normalizeCursor(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

export async function getFunctionErrorMessage(error: unknown): Promise<string> {
  const fallback =
    error instanceof Error
      ? error.message
      : typeof (error as { message?: unknown } | null)?.message === "string"
        ? ((error as { message: string }).message)
        : "Edge Function request failed";
  const response = (error as { context?: unknown } | null)?.context;

  if (!(response instanceof Response)) return fallback;

  try {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = (await response.clone().json()) as {
        error?: unknown;
        message?: unknown;
      };
      const message = body.error ?? body.message;
      return typeof message === "string" && message.trim()
        ? message
        : fallback;
    }

    const text = await response.clone().text();
    return text.trim() || fallback;
  } catch {
    return fallback;
  }
}
