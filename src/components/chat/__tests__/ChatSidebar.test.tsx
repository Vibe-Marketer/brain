import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatSidebar } from '../ChatSidebar';

function createSession(overrides: Partial<Parameters<typeof ChatSidebar>[0]['sessions'][number]> = {}) {
  return {
    id: 'session-1',
    title: 'Original title',
    message_count: 2,
    last_message_at: new Date().toISOString(),
    is_pinned: false,
    is_archived: false,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('ChatSidebar rename', () => {
  it('renames a chat from sidebar title double-click', () => {
    const onRenameSession = vi.fn();

    render(
      <ChatSidebar
        sessions={[createSession()]}
        activeSessionId="session-1"
        onSessionSelect={vi.fn()}
        onNewChat={vi.fn()}
        onDeleteSession={vi.fn()}
        onTogglePin={vi.fn()}
        onToggleArchive={vi.fn()}
        onRenameSession={onRenameSession}
      />
    );

    const title = screen.getByText('Original title');
    fireEvent.doubleClick(title);

    const input = screen.getByLabelText('Rename chat');
    fireEvent.change(input, { target: { value: 'Renamed from sidebar' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onRenameSession).toHaveBeenCalledWith('session-1', 'Renamed from sidebar');
  });

  it('does not call rename when title is unchanged', () => {
    const onRenameSession = vi.fn();

    render(
      <ChatSidebar
        sessions={[createSession()]}
        activeSessionId="session-1"
        onSessionSelect={vi.fn()}
        onNewChat={vi.fn()}
        onDeleteSession={vi.fn()}
        onTogglePin={vi.fn()}
        onToggleArchive={vi.fn()}
        onRenameSession={onRenameSession}
      />
    );

    const title = screen.getByText('Original title');
    fireEvent.doubleClick(title);

    const input = screen.getByLabelText('Rename chat');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onRenameSession).not.toHaveBeenCalled();
  });
});
