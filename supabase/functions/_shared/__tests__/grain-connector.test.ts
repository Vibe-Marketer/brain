import { describe, expect, it, vi } from "vitest";
import {
  createHook,
  deleteHook,
  getRecording,
  getRecordingTranscript,
  GrainClient,
  listHooks,
  listRecordings,
} from "../grain-client.ts";
import {
  grainRecordingToCanonical,
  type GrainRecording,
} from "../grain-connector.ts";

describe("grain connector", () => {
  const recording: GrainRecording = {
    id: "pppp6666-qq77-rr88-ss99-tttt00000000",
    title: "All Hands",
    source: "zoom",
    url: "https://grain.com/share/recording/pppp6666-qq77-rr88-ss99-tttt00000000",
    media_type: "video",
    tags: ["all-hands"],
    start_datetime: "2025-01-01T09:30:00Z",
    end_datetime: "2025-01-01T10:00:00Z",
    duration_ms: 1_800_000,
    thumbnail_url: "https://media.grain.com/public_thumbnails/recordings/pppp6666",
    participants: [
      { id: "p1", name: "Leia Example", email: "leia@example.com", confirmed_attendee: true },
      { id: "p2", name: "Han Example", email: "han@example.com", confirmed_attendee: false },
    ],
    teams: [{ id: "team-1", name: "Sales" }],
    meeting_type: { id: "type-1", name: "Team Coordination", scope: "internal" },
    ai_summary: "We reviewed launch progress.",
    ai_action_items: [{ text: "Send launch recap" }],
    transcript: [
      { start: 8_000, end: 9_000, speaker: "Leia Example", participant_id: "p1", text: "Let's begin." },
      { start: 11_482, end: 13_000, speaker: "Han Example", participant_id: "p2", text: "The rollout is ready." },
    ],
  };

  it("normalizes Grain API recordings into canonical recordings", () => {
    const canonical = grainRecordingToCanonical(recording);

    expect(canonical).toMatchObject({
      externalId: "pppp6666-qq77-rr88-ss99-tttt00000000",
      sourceApp: "grain",
      title: "All Hands",
      recordingStartTime: "2025-01-01T09:30:00.000Z",
      recordingEndTime: "2025-01-01T10:00:00.000Z",
      durationSeconds: 1800,
      sourceUrl: "https://grain.com/share/recording/pppp6666-qq77-rr88-ss99-tttt00000000",
      participantEmails: ["leia@example.com", "han@example.com"],
    });
    expect(canonical.fullTranscript).toBe(
      "[0:08] Leia Example: Let's begin.\n\n[0:11] Han Example: The rollout is ready.",
    );
    expect(canonical.summary).toContain("We reviewed launch progress.");
    expect(canonical.summary).toContain("- Send launch recap");
    expect(canonical.sourceMetadata).toMatchObject({
      grain_recording_id: "pppp6666-qq77-rr88-ss99-tttt00000000",
      grain_source: "zoom",
      grain_media_type: "video",
      grain_tags: ["all-hands"],
      grain_ai_action_items: ["Send launch recap"],
    });
  });

  it("throws for recordings without transcript text", () => {
    expect(() =>
      grainRecordingToCanonical({
        id: "empty",
        start_datetime: "2025-01-01T09:30:00Z",
        transcript: [],
      }),
    ).toThrow(/no transcript text/);
  });
});

describe("grain client", () => {
  it("builds the documented OAuth authorization URL with PKCE parameters", () => {
    const url = new URL(
      GrainClient.buildAuthorizationUrl({
        clientId: "client-1",
        redirectUri: "https://app.callvaultai.com/oauth/callback/grain",
        state: "state-1",
        codeChallenge: "challenge-1",
      }),
    );

    expect(url.origin + url.pathname).toBe(
      "https://grain.com/_/public-api/oauth2/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("client-1");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://app.callvaultai.com/oauth/callback/grain",
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("state")).toBe("state-1");
    expect(url.searchParams.get("code_challenge")).toBe("challenge-1");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.has("client_secret")).toBe(false);
  });

  it("exchanges OAuth codes at the documented token endpoint", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            token_type: "bearer",
            access_token: "access-token",
            refresh_token: "refresh-token",
            expires_in: 3600,
          }),
          { status: 200 },
        ),
    );
    const fetchImpl = fetchMock as unknown as typeof fetch;

    await GrainClient.exchangeCodeForTokens({
      clientId: "client-1",
      clientSecret: "secret-1",
      code: "code-1",
      redirectUri: "https://app.callvaultai.com/oauth/callback/grain",
      codeVerifier: "verifier-1",
      fetchImpl,
    });

    const calls = fetchMock.mock.calls as unknown as Array<[RequestInfo | URL, RequestInit?]>;
    const [url, init] = calls[0];
    expect(String(url)).toBe("https://api.grain.com/_/public-api/oauth2/token");
    expect(init).toMatchObject({
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      grant_type: "authorization_code",
      code: "code-1",
      client_id: "client-1",
      client_secret: "secret-1",
      redirect_uri: "https://app.callvaultai.com/oauth/callback/grain",
      code_verifier: "verifier-1",
    });
  });

  it("refreshes OAuth tokens at the documented token endpoint", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            token_type: "bearer",
            access_token: "next-access-token",
            refresh_token: "next-refresh-token",
            expires_in: 3600,
          }),
          { status: 200 },
        ),
    );
    const fetchImpl = fetchMock as unknown as typeof fetch;

    await GrainClient.refreshTokens({
      clientId: "client-1",
      clientSecret: "secret-1",
      refreshToken: "refresh-token",
      fetchImpl,
    });

    const calls = fetchMock.mock.calls as unknown as Array<[RequestInfo | URL, RequestInit?]>;
    const [url, init] = calls[0];
    expect(String(url)).toBe("https://api.grain.com/_/public-api/oauth2/token");
    expect(JSON.parse(String(init?.body))).toEqual({
      grant_type: "refresh_token",
      refresh_token: "refresh-token",
      client_id: "client-1",
      client_secret: "secret-1",
    });
  });

  it("uses Grain v2 headers, filters, include body, and cursor pagination", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ cursor: "next-cursor", recordings: [] }), {
          status: 200,
        }),
    );
    const fetchImpl = fetchMock as unknown as typeof fetch;

    await listRecordings({
      token: "secret-token",
      cursor: "last-cursor",
      afterDateTime: "2025-01-01T00:00:00Z",
      beforeDateTime: "2025-02-01T00:00:00Z",
      titleSearch: "hands",
      include: { participants: true, ai_summary: true },
      fetchImpl,
    });

    const calls = fetchMock.mock.calls as unknown as Array<[RequestInfo | URL, RequestInit?]>;
    const [url, init] = calls[0];
    expect(String(url)).toBe("https://api.grain.com/_/public-api/v2/recordings");
    expect(init).toMatchObject({
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer secret-token",
        "Content-Type": "application/json",
        "Public-Api-Version": "2025-10-31",
      },
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      cursor: "last-cursor",
      include: { participants: true, ai_summary: true },
      filter: {
        title_search: "hands",
        after_datetime: "2025-01-01T00:00:00Z",
        before_datetime: "2025-02-01T00:00:00Z",
      },
    });
  });

  it("fetches a single recording through the documented v2 endpoint", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ id: "recording-1" }), {
          status: 200,
        }),
    );
    const fetchImpl = fetchMock as unknown as typeof fetch;

    await getRecording("secret-token", "recording-1", { participants: true }, fetchImpl);

    const calls = fetchMock.mock.calls as unknown as Array<[RequestInfo | URL, RequestInit?]>;
    const [url, init] = calls[0];
    expect(String(url)).toBe(
      "https://api.grain.com/_/public-api/v2/recordings/recording-1",
    );
    expect(init).toMatchObject({
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer secret-token",
        "Content-Type": "application/json",
        "Public-Api-Version": "2025-10-31",
      },
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      include: { participants: true },
    });
  });

  it("fetches recording transcripts through the documented JSON transcript endpoint", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify([]), {
          status: 200,
        }),
    );
    const fetchImpl = fetchMock as unknown as typeof fetch;

    await getRecordingTranscript("secret-token", "recording-1", fetchImpl);

    const calls = fetchMock.mock.calls as unknown as Array<[RequestInfo | URL, RequestInit?]>;
    const [url, init] = calls[0];
    expect(String(url)).toBe(
      "https://api.grain.com/_/public-api/v2/recordings/recording-1/transcript",
    );
    expect(init).toMatchObject({
      headers: {
        Accept: "application/json",
        Authorization: "Bearer secret-token",
        "Content-Type": "application/json",
        "Public-Api-Version": "2025-10-31",
      },
    });
  });

  it("creates recording hooks through the documented hooks endpoint", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ id: "hook-1", hook_type: "recording_added" }), {
          status: 200,
        }),
    );
    const fetchImpl = fetchMock as unknown as typeof fetch;

    await createHook(
      "secret-token",
      {
        hookUrl: "https://example.com/functions/v1/grain-webhook/token-1",
        hookType: "recording_added",
        include: { participants: true, ai_summary: true },
      },
      fetchImpl,
    );

    const calls = fetchMock.mock.calls as unknown as Array<[RequestInfo | URL, RequestInit?]>;
    const [url, init] = calls[0];
    expect(String(url)).toBe("https://api.grain.com/_/public-api/v2/hooks/create");
    expect(init).toMatchObject({
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer secret-token",
        "Content-Type": "application/json",
        "Public-Api-Version": "2025-10-31",
      },
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      hook_url: "https://example.com/functions/v1/grain-webhook/token-1",
      hook_type: "recording_added",
      include: { participants: true, ai_summary: true },
    });
  });

  it("lists enabled recording hooks through the documented hooks endpoint", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ hooks: [] }), {
          status: 200,
        }),
    );
    const fetchImpl = fetchMock as unknown as typeof fetch;

    await listHooks("secret-token", { hookType: "recording_added", state: "enabled" }, fetchImpl);

    const calls = fetchMock.mock.calls as unknown as Array<[RequestInfo | URL, RequestInit?]>;
    const [url, init] = calls[0];
    expect(String(url)).toBe("https://api.grain.com/_/public-api/v2/hooks");
    expect(init).toMatchObject({ method: "POST" });
    expect(JSON.parse(String(init?.body))).toEqual({
      filter: { hook_type: "recording_added", state: "enabled" },
    });
  });

  it("deletes hooks through the documented delete hook endpoint", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ success: true }), {
          status: 200,
        }),
    );
    const fetchImpl = fetchMock as unknown as typeof fetch;

    await deleteHook("secret-token", "hook-1", fetchImpl);

    const calls = fetchMock.mock.calls as unknown as Array<[RequestInfo | URL, RequestInit?]>;
    const [url, init] = calls[0];
    expect(String(url)).toBe("https://api.grain.com/_/public-api/v2/hooks/hook-1");
    expect(init).toMatchObject({ method: "DELETE" });
  });
});
