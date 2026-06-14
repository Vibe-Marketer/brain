import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-utils", () => ({
  getSafeUser: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

import { supabase } from "@/integrations/supabase/client";
import { getSafeUser } from "@/lib/auth-utils";
import { disconnectConnectorSource } from "../useConnector";

const getSafeUserMock = vi.mocked(getSafeUser);
const rpcMock = vi.mocked(supabase.rpc);
const disconnectedResponse = {
  data: { disconnected: true },
  error: null,
} as Awaited<ReturnType<typeof supabase.rpc>>;

describe("disconnectConnectorSource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSafeUserMock.mockResolvedValue({
      user: { id: "user-1" } as Awaited<
        ReturnType<typeof getSafeUser>
      >["user"],
      error: null,
    });
    rpcMock.mockResolvedValue(disconnectedResponse);
  });

  it("delegates legacy Fathom disconnect to the shared RPC", async () => {
    await disconnectConnectorSource({ sourceApp: "fathom", sourceId: null });

    expect(rpcMock).toHaveBeenCalledWith("disconnect_connector_source", {
      p_source_app: "fathom",
      p_source_id: null,
    });
  });

  it("passes source id and source app to the shared RPC", async () => {
    await disconnectConnectorSource({
      sourceApp: "fathom",
      sourceId: "source-1",
    });

    expect(rpcMock).toHaveBeenCalledWith("disconnect_connector_source", {
      p_source_app: "fathom",
      p_source_id: "source-1",
    });
  });

  it("uses the same RPC for Zoom so legacy tokens are cleared server-side", async () => {
    await disconnectConnectorSource({
      sourceApp: "zoom",
      sourceId: "source-1",
    });

    expect(rpcMock).toHaveBeenCalledWith("disconnect_connector_source", {
      p_source_app: "zoom",
      p_source_id: "source-1",
    });
  });
});
