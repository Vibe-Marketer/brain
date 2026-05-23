/**
 * File Upload connector adapter. Issue #283 — Phase 1.
 *
 * Direct file upload — no auth, no remote sync. Always available.
 */

import { RiUploadCloud2Line } from "@remixicon/react";
import type { ConnectorAdapter } from "../types";

export const fileUploadAdapter: ConnectorAdapter = {
  metadata: {
    sourceApp: "file-upload",
    label: "File Upload",
    description: "Direct upload",
    icon: RiUploadCloud2Line,
    brandColor: "#6B7280",
    authMethods: ["none"],
    order: 60,
  },
};
