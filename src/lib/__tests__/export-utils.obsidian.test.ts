import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildObsidianFileName,
  buildObsidianMarkdown,
  buildObsidianVaultPath,
  exportSingleCallToObsidian,
  exportToObsidian,
  type ExportableCall,
} from '../export-utils';

const zipMockState = vi.hoisted(() => ({
  instances: [] as Array<{
    files: Map<string, string>;
    generateAsync: ReturnType<typeof vi.fn>;
  }>,
  saveAs: vi.fn(),
}));

vi.mock('file-saver', () => ({
  saveAs: zipMockState.saveAs,
}));

vi.mock('jszip', () => ({
  default: class JSZipMock {
    files = new Map<string, string>();
    generateAsync = vi.fn(async () => new Blob(['zip']));

    constructor() {
      zipMockState.instances.push(this);
    }

    file(path: string, content: string) {
      this.files.set(path, content);
      return this;
    }
  },
}));

function makeCall(overrides: Partial<ExportableCall> = {}): ExportableCall {
  return {
    recording_id: overrides.recording_id ?? 'legacy-1',
    canonical_uuid: overrides.canonical_uuid ?? '11111111-1111-1111-1111-111111111111',
    title: overrides.title ?? 'Quarterly Review',
    created_at: overrides.created_at ?? '2026-06-01T12:00:00.000Z',
    recording_start_time: overrides.recording_start_time ?? '2026-06-01T12:00:00.000Z',
    recording_end_time: overrides.recording_end_time ?? '2026-06-01T12:45:00.000Z',
    recorded_by_name: overrides.recorded_by_name ?? 'Ada Lovelace',
    recorded_by_email: overrides.recorded_by_email ?? 'ada@example.com',
    calendar_invitees: overrides.calendar_invitees ?? [
      { name: 'Grace Hopper', email: 'grace@example.com' },
    ],
    full_transcript:
      overrides.full_transcript === undefined
        ? 'Speaker 1: Stored transcript body'
        : overrides.full_transcript,
    summary: overrides.summary === undefined ? 'Discussed launch readiness.' : overrides.summary,
    url: overrides.url === undefined ? 'https://calls.example/share/1' : overrides.url,
    workspace_name: overrides.workspace_name === undefined ? 'Sales' : overrides.workspace_name,
    tag_names: overrides.tag_names,
    transcript_segments: overrides.transcript_segments,
  };
}

function latestFiles() {
  const latest = zipMockState.instances.at(-1);
  if (!latest) throw new Error('Expected a JSZip instance');
  return latest.files;
}

function readBlobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result)));
    reader.addEventListener('error', () => reject(reader.error));
    reader.readAsText(blob);
  });
}

describe('exportToObsidian', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    zipMockState.instances.length = 0;
    vi.setSystemTime(new Date('2026-06-10T12:00:00.000Z'));
  });

  it('writes one markdown file per included call under CallVault org and workspace paths', async () => {
    await exportToObsidian(
      [
        makeCall({ canonical_uuid: 'rec-1', title: 'Sales Followup', workspace_name: 'Sales' }),
        makeCall({ canonical_uuid: 'rec-2', title: 'Support Review', workspace_name: 'Support' }),
        makeCall({ canonical_uuid: 'rec-3', title: 'Excluded', workspace_name: 'Archive' }),
      ],
      'Acme Inc',
      ['Archive'],
    );

    const files = latestFiles();
    expect(files.size).toBe(2);
    expect([...files.keys()]).toContain('CallVault/Acme Inc/Sales/2026-06-01-sales-followup.md');
    expect([...files.keys()]).toContain('CallVault/Acme Inc/Support/2026-06-01-support-review.md');
    expect([...files.keys()].some((path) => path.includes('Archive'))).toBe(false);
  });

  it('creates duplicate filename suffixes and includes required YAML front matter', async () => {
    await exportToObsidian(
      [
        makeCall({ canonical_uuid: 'rec-1', title: 'Same Title' }),
        makeCall({ canonical_uuid: 'rec-2', title: 'Same Title' }),
      ],
      'Acme "Quoted"',
    );

    const files = latestFiles();
    const first = files.get('CallVault/Acme -Quoted-/Sales/2026-06-01-same-title.md') ?? '';
    const second = files.get('CallVault/Acme -Quoted-/Sales/2026-06-01-same-title-1.md') ?? '';

    expect(second).toContain('vault_path: "CallVault/Acme -Quoted-/Sales/2026-06-01-same-title-1.md"');
    expect(first).toContain('callvault_id: "rec-1"');
    expect(first).toContain('workspace: "Sales"');
    expect(first).toContain('tags:');
    expect(first).toContain('has_transcript: true');
    expect(first).toContain('participants:');
    expect(first).toContain('- "[[Grace Hopper]]"');
    expect(first).toContain('share_url: "https://calls.example/share/1"');
  });

  it('builds reusable Obsidian filenames, vault paths, and markdown with CallVault tags', () => {
    const call = makeCall({
      title: 'Renewal: Risk / Plan',
      full_transcript: 'Speaker 1: [00:01] keep brackets\n\nSpeaker 2: keep blank lines',
      tag_names: ['Follow Up', 'Customer Risk'],
    });
    const vaultPath = buildObsidianVaultPath(call, 'Acme Inc', 'Customer Success');
    const markdown = buildObsidianMarkdown(call, {
      orgName: 'Acme Inc',
      workspaceName: 'Customer Success',
      syncedAt: '2026-06-10T12:00:00.000Z',
      vaultPath,
    });

    expect(buildObsidianFileName(call)).toBe('2026-06-01-renewal-risk-plan.md');
    expect(vaultPath).toBe('CallVault/Acme Inc/Customer Success/2026-06-01-renewal-risk-plan.md');
    expect(markdown).toContain('vault_path: "CallVault/Acme Inc/Customer Success/2026-06-01-renewal-risk-plan.md"');
    expect(markdown).toContain('callvault_id: "11111111-1111-1111-1111-111111111111"');
    expect(markdown).toContain('has_transcript: true');
    expect(markdown).toContain('- "call-tags/follow-up"');
    expect(markdown).toContain('- "call-tags/customer-risk"');
    expect(markdown).toContain('# Renewal: Risk / Plan');
    expect(markdown).toContain('## Transcript\n\nSpeaker 1: [00:01] keep brackets\n\nSpeaker 2: keep blank lines');
  });

  it('escapes YAML strings and preserves stored transcript text under Transcript', async () => {
    await exportToObsidian(
      [
        makeCall({
          title: 'Quote "Heavy" Title',
          workspace_name: 'Customer "Success"',
          recorded_by_name: 'Ada "Countess"',
          calendar_invitees: [{ name: 'Grace "Compiler"', email: 'grace@example.com' }],
          full_transcript: 'Line one\n\nLine two with [00:01] preserved.',
        }),
      ],
      'Acme Org',
    );

    const content = [...latestFiles().values()][0];
    expect(content).toContain('workspace: "Customer \\"Success\\""');
    expect(content).toContain('- "[[Ada \\"Countess\\"]]"');
    expect(content).toContain('- "[[Grace \\"Compiler\\"]]"');
    expect(content).toContain('## Transcript\n\nLine one\n\nLine two with [00:01] preserved.');
  });

  it('uses explicit missing transcript text', async () => {
    await exportToObsidian([makeCall({ full_transcript: null })], 'Acme Inc');

    expect([...latestFiles().values()][0]).toContain('Transcript not available.');
  });

  it('exports a single call as one markdown Blob without creating a ZIP', async () => {
    const call = makeCall({
      title: 'Standalone Obsidian Note',
      full_transcript: 'Speaker 1: Transcript with [brackets]\n\nSpeaker 2: Blank line preserved.',
      tag_names: ['Exec Review'],
    });

    exportSingleCallToObsidian(call, {
      orgName: 'Acme Inc',
      workspaceName: 'Sales',
    });

    expect(zipMockState.instances).toHaveLength(0);
    expect(zipMockState.saveAs).toHaveBeenCalledTimes(1);
    const [blob, fileName] = zipMockState.saveAs.mock.calls[0] as [Blob, string];
    expect(fileName).toBe('2026-06-01-standalone-obsidian-note.md');
    expect(blob.type).toBe('text/markdown;charset=utf-8');

    const text = await readBlobText(blob);
    expect(text).toContain('type: call');
    expect(text).toContain('vault_path: "CallVault/Acme Inc/Sales/2026-06-01-standalone-obsidian-note.md"');
    expect(text).toContain('callvault_id: "11111111-1111-1111-1111-111111111111"');
    expect(text).toContain('- "[[Grace Hopper]]"');
    expect(text).toContain('## Summary\n\nDiscussed launch readiness.');
    expect(text).toContain('## Transcript\n\nSpeaker 1: Transcript with [brackets]\n\nSpeaker 2: Blank line preserved.');
    expect(text).toContain('share_url: "https://calls.example/share/1"');
    expect(text).toContain('- "call-tags/exec-review"');
    expect(text).toContain('# Standalone Obsidian Note');
  });

  it('exports a single no-transcript call with the explicit missing transcript message', async () => {
    exportSingleCallToObsidian(makeCall({ full_transcript: null }), {
      orgName: 'Acme Inc',
      workspaceName: 'Sales',
    });

    const [blob] = zipMockState.saveAs.mock.calls[0] as [Blob, string];
    await expect(readBlobText(blob)).resolves.toContain('Transcript not available.');
  });

  it('prefers structured transcript segments over stored full_transcript text', async () => {
    await exportToObsidian(
      [
        makeCall({
          full_transcript: 'Flattened fallback should not appear.',
          transcript_segments: [
            {
              speaker_name: 'Structured Speaker',
              speaker_email: 'speaker@example.com',
              text: 'Structured body wins.',
              timestamp: '0:04',
            },
          ],
        }),
      ],
      'Acme Inc',
    );

    const content = [...latestFiles().values()][0];
    expect(content).toContain('[0:04] Structured Speaker (speaker@example.com): Structured body wins.');
    expect(content).not.toContain('Flattened fallback should not appear.');
  });

  it('represents exactly 5,000 transcript-bearing calls in the ZIP output', async () => {
    const calls = Array.from({ length: 5000 }, (_, index) =>
      makeCall({
        recording_id: `legacy-${index}`,
        canonical_uuid: `rec-${String(index).padStart(4, '0')}`,
        title: `Scale Test ${index}`,
        full_transcript: `Transcript body ${index}`,
      }),
    );

    await exportToObsidian(calls, 'Acme Inc');

    const files = latestFiles();
    expect(files.size).toBe(5000);
    expect(files.get('CallVault/Acme Inc/Sales/2026-06-01-scale-test-4999.md')).toContain(
      'Transcript body 4999',
    );
  });
});
