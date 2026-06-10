import { describe, expect, it, vi } from 'vitest';
import { canonicalToConnectorRecord } from '../canonical-recording.ts';
import {
  decodePlaudAccessTokenExpiry,
  parsePlaudConnectionMetadata,
  PlaudClient,
  type PlaudFile,
} from '../plaud-client.ts';
import { plaudFileToCanonical } from '../plaud-connector.ts';

describe('plaud connector', () => {
  const consumerFile: PlaudFile = {
    id: 'file_consumer_01',
    filename: 'Plaud Field Notes',
    start_time: 1748007000000,
    end_time: 1748007125000,
    duration: 125_000,
    serial_number: 'PLAUD123',
    trans_result: [
      { start_time: 0, end_time: 2100, speaker: 'Andrew', content: 'First Plaud turn.' },
      { start_time: 2350, end_time: 6100, speaker: 'Don', content: 'Second Plaud turn.' },
    ],
    ai_content: JSON.stringify({ markdown: '## Summary\n\nPlaud summary.' }),
    is_trans: true,
    is_summary: true,
  };

  const legacyFile: PlaudFile = {
    id: 'file_legacy_01',
    name: 'Legacy Plaud Payload',
    created_at: '2026-05-23T14:00:00.000Z',
    start_at: '2026-05-23T13:30:00.000Z',
    duration: 125_000,
    serial_number: 'PLAUD123',
    presigned_url: 'https://resource.plaud.ai/audio/file_legacy_01',
    source_list: [
      {
        id: 'src_1',
        data_type: 'transaction',
        data_content: JSON.stringify([
          { start_time: 0, end_time: 2100, speaker: 'Andrew', content: 'First Plaud turn.' },
          { start_time: 2350, end_time: 6100, speaker: 'Don', content: 'Second Plaud turn.' },
        ]),
      },
    ],
    note_list: [
      { id: 'note_1', data_type: 'auto_sum_note', data_content: '## Summary\n\nPlaud summary.' },
    ],
  };

  it('normalizes consumer Plaud file payloads into canonical recordings', () => {
    const canonical = plaudFileToCanonical(consumerFile);

    expect(canonical).toMatchObject({
      externalId: 'file_consumer_01',
      sourceApp: 'plaud',
      title: 'Plaud Field Notes',
      recordingStartTime: '2025-05-23T13:30:00.000Z',
      recordingEndTime: '2025-05-23T13:32:05.000Z',
      durationSeconds: 125,
      summary: '## Summary\n\nPlaud summary.',
    });
    expect(canonical.fullTranscript).toBe('[0:00] Andrew: First Plaud turn.\n\n[0:02] Don: Second Plaud turn.');
    expect(canonical.transcriptTurns).toEqual([
      {
        speakerName: 'Andrew',
        text: 'First Plaud turn.',
        startSeconds: 0,
        endSeconds: 2.1,
      },
      {
        speakerName: 'Don',
        text: 'Second Plaud turn.',
        startSeconds: 2.35,
        endSeconds: 6.1,
      },
    ]);
    expect(canonical.sourceMetadata).toMatchObject({
      plaud_file_id: 'file_consumer_01',
      plaud_serial_number: 'PLAUD123',
      plaud_transcript_available: true,
      plaud_summary_available: true,
      plaud_api_shape: 'consumer',
      transcript_speaker_names: ['Andrew', 'Don'],
    });
  });

  it('keeps compatibility with legacy Plaud developer payloads', () => {
    const canonical = plaudFileToCanonical(legacyFile);
    expect(canonical.title).toBe('Legacy Plaud Payload');
    expect(canonical.sourceMetadata).toMatchObject({ plaud_api_shape: 'developer' });
  });

  it('produces connector pipeline field names and stable dedupe keys', () => {
    const connectorRecord = canonicalToConnectorRecord(plaudFileToCanonical(consumerFile), {
      importSource: 'plaud-sync-recordings',
      workspaceId: 'workspace-1',
    });

    expect(connectorRecord).toMatchObject({
      external_id: 'file_consumer_01',
      source_app: 'plaud',
      title: 'Plaud Field Notes',
      workspace_id: 'workspace-1',
    });
    expect(connectorRecord.full_transcript).toContain('Andrew: First Plaud turn.');
    expect(connectorRecord.source_metadata.import_source).toBe('plaud-sync-recordings');
  });

  it('uses consumer Plaud endpoints with browser-style headers', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/team-app/workspaces/list')) {
        return new Response(JSON.stringify({
          status: 0,
          data: { workspaces: [{ workspace_id: 'workspace-1', member_id: 'member-1', name: 'Personal', role: 'owner', status: 'active', workspace_type: '0' }] },
        }), { status: 200 });
      }
      if (url.includes('/user-app/auth/workspace/token/')) {
        return new Response(JSON.stringify({
          status: 0,
          data: { status: 0, workspace_token: 'wt-123', expires_in: 86400, wt_expires_at: 0, refresh_token: 'rt', refresh_expires_in: 0, refresh_expires_at: 0, workspace_id: 'workspace-1', member_id: 'member-1', role: 'owner' },
        }), { status: 200 });
      }
      return new Response(JSON.stringify({ status: 0, data_file_total: 0, data_file_list: [] }), { status: 200 });
    }) as unknown as typeof fetch;

    const client = new PlaudClient('user-token', { apiBase: 'https://api.plaud.ai', fetchImpl });
    await client.listFilesByOffset(0, 20);

    expect(fetchImpl).toHaveBeenLastCalledWith(
      expect.stringContaining('https://api.plaud.ai/file/simple/web?'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer wt-123',
          Origin: 'https://web.plaud.ai',
          'app-platform': 'web',
        }),
      }),
    );
  });

  it('decodes Plaud access token expiry and connection metadata safely', () => {
    const token = [
      'header',
      'eyJleHAiOjE4MDAwMDAwMDB9',
      'signature',
    ].join('.');

    expect(decodePlaudAccessTokenExpiry(token)).toBe(1800000000000);
    expect(parsePlaudConnectionMetadata({ api_base: 'https://api.plaud.ai/', workspace_id: 'workspace-1', auth_type: 'consumer_token' })).toEqual({
      api_base: 'https://api.plaud.ai',
      workspace_id: 'workspace-1',
      auth_type: 'consumer_token',
      server_key: null,
      using_user_token_fallback: null,
      workspace_error: null,
    });
  });
});
