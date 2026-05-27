/**
 * Legacy file import connector adapter. Issue #283 — Phase 1.
 *
 * Hidden compatibility source — no auth, no remote sync. Always available
 * internally for historical rows.
 */

import { RiUploadCloud2Line } from "@remixicon/react";
import type { ConnectorAdapter } from "../types";

export const fileUploadAdapter: ConnectorAdapter = {
  metadata: {
    sourceApp: "file-upload",
    label: "Legacy File Import",
    description: "Hidden compatibility source",
    icon: RiUploadCloud2Line,
    brandColor: "#6B7280",
    authMethods: ["none"],
    order: 60,
  },
  setup: {
    kind: "none",
    helperCopy: {
      disconnected:
        "Legacy file import is retained for historical records. No connector setup is required.",
      connected: "Legacy file import compatibility is available without account setup.",
    },
  },
};
