import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockInvoke = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

vi.mock('@/hooks/useRoutingRules', () => ({
  useRoutingDefault: () => ({
    data: { target_workspace_id: 'workspace-1', target_folder_id: null },
    isLoading: false,
  }),
}));

vi.mock('@/components/import/DefaultDestinationBar', () => ({
  DefaultDestinationBar: () => <div data-testid="default-destination-bar">YouTube calls go to</div>,
}));

import { YouTubeImportForm } from '../YouTubeImportForm';

describe('YouTubeImportForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockReset();
  });

  it('fetches and renders fast YouTube link metadata after a URL is entered', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          source_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          share_token: 'dQw4w9WgXcQ',
          source_app: 'youtube',
          provider_name: 'YouTube',
          title: 'Launch Review',
          author_name: 'CallVault',
          thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        },
      },
      error: null,
    });

    render(
      <YouTubeImportForm
        onSuccess={() => {}}
        onError={() => {}}
      />,
    );

    fireEvent.change(screen.getByLabelText(/youtube url/i), {
      target: { value: 'https://youtu.be/dQw4w9WgXcQ' },
    });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'fetch-source-metadata',
        expect.objectContaining({
          body: { source_url: 'https://youtu.be/dQw4w9WgXcQ' },
        }),
      );
    });
    expect(await screen.findByText('Launch Review')).toBeInTheDocument();
    expect(screen.getByText(/YouTube · CallVault/)).toBeInTheDocument();
  });
});
