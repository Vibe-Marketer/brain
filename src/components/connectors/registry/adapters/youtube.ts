/**
 * YouTube connector adapter. Issue #283 — Phase 1.
 *
 * YouTube imports are URL-driven — no auth needed beyond the user being
 * signed into CallVault. The "Connected" state is permanently true.
 */

import { RiYoutubeLine } from "@remixicon/react";
import type { ConnectorAdapter } from "../types";

export const youtubeAdapter: ConnectorAdapter = {
  metadata: {
    sourceApp: "youtube",
    label: "YouTube",
    description: "Video imports",
    icon: RiYoutubeLine,
    brandColor: "#FF0000",
    authMethods: ["none"],
    order: 50,
  },
  // No OAuth, no API key, no disconnect — always available.
};
