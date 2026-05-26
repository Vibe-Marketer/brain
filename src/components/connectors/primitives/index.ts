/**
 * Connector card primitives — single source of truth for vendor cards.
 *
 * Six former vendor-card components (SourceCard, IntegrationSourceCard,
 * IntegrationStatusRow, CompactIntegrationButton, plus inline declarations
 * in OnboardingModal and ConnectorPanel) all converge on these four variants
 * over a single ConnectorCard base.
 */
export { ConnectorCard } from "./ConnectorCard";
export type { ConnectorCardProps, ConnectorCardStatus } from "./ConnectorCard";

export { ConnectorCardSquare } from "./ConnectorCardSquare";
export type { ConnectorCardSquareProps } from "./ConnectorCardSquare";

export { ConnectorCardTile } from "./ConnectorCardTile";
export type { ConnectorCardTileProps } from "./ConnectorCardTile";

export { ConnectorCardRow } from "./ConnectorCardRow";
export type { ConnectorCardRowProps } from "./ConnectorCardRow";

export { ConnectorCardFull } from "./ConnectorCardFull";
export type { ConnectorCardFullProps } from "./ConnectorCardFull";
