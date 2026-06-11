import { describe, expect, it, vi, beforeEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';
import {
  submitSupportTicket,
  uploadTicketAttachment,
} from '@/services/support-ticket.service';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    storage: { from: vi.fn() },
    functions: { invoke: vi.fn() },
  },
}));

const mockStorageFrom = vi.mocked(supabase.storage.from);
const mockInvoke = vi.mocked(supabase.functions.invoke);

function mockUpload(result: { data: { path: string } | null; error: Error | null }) {
  const upload = vi.fn().mockResolvedValue(result);
  mockStorageFrom.mockReturnValue({ upload } as unknown as ReturnType<typeof supabase.storage.from>);
  return upload;
}

function makeBlob(content = 'jpegdata', type = 'image/jpeg'): Blob {
  return new Blob([content], { type });
}

describe('uploadTicketAttachment', () => {
  beforeEach(() => {
    mockStorageFrom.mockReset();
    mockInvoke.mockReset();
  });

  it('uploads under the reporter own-folder path and returns the descriptor', async () => {
    const upload = mockUpload({ data: { path: 'x' }, error: null });
    const blob = makeBlob();

    const descriptor = await uploadTicketAttachment('user-1', blob, 'screenshot', 1718000000000);

    expect(mockStorageFrom).toHaveBeenCalledWith('ticket-attachments');
    const [path, uploadedBlob, options] = upload.mock.calls[0];
    expect(path).toMatch(/^user-1\/[0-9a-f-]{36}\.jpg$/);
    expect(uploadedBlob).toBe(blob);
    expect(options).toMatchObject({ contentType: 'image/jpeg', upsert: false });

    expect(descriptor).toEqual({
      type: 'screenshot',
      bucket: 'ticket-attachments',
      path,
      mime: 'image/jpeg',
      size_bytes: blob.size,
      captured_at: new Date(1718000000000).toISOString(),
    });
  });

  it('uses a .json extension and application/json mime for console_log attachments', async () => {
    const upload = mockUpload({ data: { path: 'x' }, error: null });
    const blob = makeBlob('{"entries":[]}', 'application/json');

    const descriptor = await uploadTicketAttachment('user-1', blob, 'console_log', 1718000000000);

    const [path] = upload.mock.calls[0];
    expect(path).toMatch(/^user-1\/[0-9a-f-]{36}\.json$/);
    expect(descriptor.mime).toBe('application/json');
    expect(descriptor.type).toBe('console_log');
  });

  it('throws when the storage upload returns an error', async () => {
    mockUpload({ data: null, error: new Error('storage exploded') });

    await expect(
      uploadTicketAttachment('user-1', makeBlob(), 'screenshot', 1718000000000),
    ).rejects.toThrow();
  });
});

describe('submitSupportTicket attachments (D-04)', () => {
  beforeEach(() => {
    mockStorageFrom.mockReset();
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null } as never);
  });

  it('uploads the screenshot first and includes its descriptor in the invoke body', async () => {
    mockUpload({ data: { path: 'x' }, error: null });

    await submitSupportTicket({
      message: 'something broke',
      userId: 'user-1',
      screenshot: { blob: makeBlob(), capturedAt: 1718000000000 },
    });

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    const body = mockInvoke.mock.calls[0][1]?.body as Record<string, unknown>;
    const attachments = body.attachments as Array<Record<string, unknown>>;
    expect(attachments).toHaveLength(1);
    expect(attachments[0]).toMatchObject({
      type: 'screenshot',
      bucket: 'ticket-attachments',
      mime: 'image/jpeg',
    });
    expect(String(attachments[0].path)).toMatch(/^user-1\//);
  });

  it('omits the attachments key entirely when no screenshot is provided', async () => {
    await submitSupportTicket({ message: 'no screenshot here', userId: 'user-1' });

    const body = mockInvoke.mock.calls[0][1]?.body as Record<string, unknown>;
    expect(body).not.toHaveProperty('attachments');
    expect(mockStorageFrom).not.toHaveBeenCalled();
  });

  it('still submits the ticket (without attachments) when the upload fails', async () => {
    mockUpload({ data: null, error: new Error('storage exploded') });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    await submitSupportTicket({
      message: 'upload will fail',
      userId: 'user-1',
      screenshot: { blob: makeBlob(), capturedAt: 1718000000000 },
    });

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    const body = mockInvoke.mock.calls[0][1]?.body as Record<string, unknown>;
    expect(body).not.toHaveProperty('attachments');
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('skips the upload and submits without attachments when userId is absent', async () => {
    await submitSupportTicket({
      message: 'anonymous-ish',
      screenshot: { blob: makeBlob(), capturedAt: 1718000000000 },
    });

    expect(mockStorageFrom).not.toHaveBeenCalled();
    const body = mockInvoke.mock.calls[0][1]?.body as Record<string, unknown>;
    expect(body).not.toHaveProperty('attachments');
  });
});
