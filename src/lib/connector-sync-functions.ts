import { tryGetSourceConfig } from "@/config/source-registry";

export function getConnectorSyncFunctionName(
  sourceApp: string,
): string | null {
  return tryGetSourceConfig(sourceApp)?.syncFunctionName ?? null;
}

export function canRetryFailedImport(sourceApp: string): boolean {
  return getConnectorSyncFunctionName(sourceApp) !== null;
}
