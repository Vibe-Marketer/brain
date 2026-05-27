import {
  tryGetSourceConfig,
  type SourceId,
} from "@/config/source-registry";
import { isKnownSourceApp } from "@/components/connectors/registry/connectorRegistry";
import type { ConnectorSourceApp } from "@/components/connectors/registry/types";

export type ImportSourceFlow =
  | "connector-wizard"
  | "public-url"
  | "paste-transcript"
  | "routing-rules"
  | "import-history"
  | "unknown";

export type ImportNavigationSource = SourceId | "routing-rules" | "import-history";

export function getImportSourceFlow(
  source: string | null | undefined,
): ImportSourceFlow {
  if (!source) return "unknown";
  if (source === "routing-rules") return "routing-rules";
  if (source === "import-history") return "import-history";

  const config = tryGetSourceConfig(source);
  if (!config) return "unknown";
  if (config.id === "file-upload") return "unknown";

  if (
    config.adapter === "native" &&
    config.authMode !== "public-url" &&
    config.authMode !== "none"
  ) {
    return "connector-wizard";
  }

  if (config.authMode === "public-url") return "public-url";
  if (config.id === "paste-transcript") return "paste-transcript";
  return "unknown";
}

export function isSelectableImportSource(
  source: string,
): source is ImportNavigationSource {
  return getImportSourceFlow(source) !== "unknown";
}

export function isConnectorWizardImportSource(
  source: string | null | undefined,
): source is ConnectorSourceApp {
  return (
    isKnownSourceApp(source) &&
    getImportSourceFlow(source) === "connector-wizard"
  );
}
