/**
 * Phase 25 Nyquist coverage — TranscriptsNew drag isolation.
 *
 * The fix at commit e00c268d ("isolates workspace drags from call drags") guarantees:
 *   - When a workspace row is dragged (active.data.current.type === 'workspace'),
 *     dragHelpers.handleDragStart is NOT called → activeDragId stays null
 *     → call-drag UI (DragOverlay "Moving call...", workspace-zone highlights for
 *     recordings) does NOT activate
 *   - When a recording row is dragged, the call-drag bookkeeping runs as before
 *
 * Test strategy:
 *   1. Source-level invariant — verify the guard predicate exists in TranscriptsNew.tsx
 *      and is positioned as an early-return inside onDragStart, before handleDragStart is called
 *   2. Behavioral — re-implement the handler shape (real useDragAndDrop hook + the same
 *      gating logic) and prove that activeDragId stays null for workspace drags but flips
 *      for recording drags.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DragStartEvent } from '@dnd-kit/core';
import { useDragAndDrop } from '@/hooks/useDragAndDrop';

const REPO_ROOT = resolve(__dirname, '../../..');
function readSrc(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), 'utf-8');
}

describe('TranscriptsNew source — drag isolation guard', () => {
  const src = readSrc('src/pages/TranscriptsNew.tsx');

  it('imports useWorkspaceReorder so the reorder handler can fire alongside recording drags', () => {
    expect(src).toMatch(/from\s+["']@\/hooks\/useWorkspaceReorder["']/);
    expect(src).toMatch(/handleWorkspaceReorderDragEnd/);
  });

  it('the onDragStart guard returns early when active.data.current.type === "workspace"', () => {
    // Locate the DndContext onDragStart prop. It must early-return for workspace drags
    // BEFORE calling dragHelpers.handleDragStart.
    const dndContextMatch = src.match(/<DndContext[\s\S]*?onDragStart=\{([\s\S]*?)\}\s*\n?\s*onDragEnd/);
    expect(dndContextMatch, 'expected onDragStart prop in DndContext').not.toBeNull();
    const onDragStart = dndContextMatch![1];

    // Guard appears
    expect(onDragStart).toMatch(/active\.data\?\.current\?\.type\s*===\s*['"]workspace['"]/);

    // Guard is BEFORE the handleDragStart call
    const guardIdx = onDragStart.search(
      /active\.data\?\.current\?\.type\s*===\s*['"]workspace['"]/,
    );
    const callIdx = onDragStart.indexOf('dragHelpers.handleDragStart');
    expect(guardIdx).toBeGreaterThan(-1);
    expect(callIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeLessThan(callIdx);

    // The guard ends with `return` — i.e. early-return, not just a logical AND
    expect(onDragStart).toMatch(
      /active\.data\?\.current\?\.type\s*===\s*['"]workspace['"]\s*\)\s*return\s*;?/,
    );
  });

  it('the onDragEnd handler also short-circuits for workspace drags so they never feed moveToWorkspace', () => {
    // After handleWorkspaceReorderDragEnd runs, the handler must return BEFORE the
    // recording-drop branches if active.data.current.type === 'workspace'.
    expect(src).toMatch(
      /handleWorkspaceReorderDragEnd\(event\);[\s\S]{0,500}active\.data\?\.current\?\.type\s*===\s*['"]workspace['"][\s\S]{0,120}return;/,
    );
  });
});

// ─── Behavioral simulation ──────────────────────────────────────────────────

/**
 * Mirror the exact onDragStart shape used in TranscriptsNew.tsx (lines 313-320 at audit time).
 * If the implementation drifts, the source-level test above will catch it; this test verifies
 * the SHAPE behaves correctly when wired against the real useDragAndDrop hook.
 */
function buildOnDragStart(handleDragStart: (e: DragStartEvent, sel: (string | number)[]) => void) {
  return (e: DragStartEvent) => {
    if (e.active.data?.current?.type === 'workspace') return;
    handleDragStart(e, []);
  };
}

function makeDragStartEvent(args: {
  id: string;
  type?: 'workspace' | 'recording';
}): DragStartEvent {
  return {
    active: {
      id: args.id,
      data: { current: args.type ? { type: args.type } : undefined },
      rect: { current: { initial: null, translated: null } },
    },
  } as unknown as DragStartEvent;
}

describe('TranscriptsNew drag isolation — behavioral', () => {
  it('workspace drag: activeDragId stays null (call-drag UI does not activate)', () => {
    const { result } = renderHook(() => useDragAndDrop());
    const onDragStart = buildOnDragStart(result.current.handleDragStart);

    expect(result.current.activeDragId).toBeNull();
    act(() => {
      onDragStart(makeDragStartEvent({ id: 'ws-uuid-123', type: 'workspace' }));
    });
    expect(result.current.activeDragId).toBeNull();
    expect(result.current.draggedItems).toEqual([]);
  });

  it('recording drag: activeDragId IS set (existing call-drag UI continues to work)', () => {
    const { result } = renderHook(() => useDragAndDrop());
    const onDragStart = buildOnDragStart(result.current.handleDragStart);

    act(() => {
      onDragStart(makeDragStartEvent({ id: 'recording-12345' }));
    });
    expect(result.current.activeDragId).toBe('recording-12345');
    expect(result.current.draggedItems).toEqual(['recording-12345']);
  });

  it('workspace drag does not pollute draggedItems even after a real recording drag', () => {
    const { result } = renderHook(() => useDragAndDrop());
    const onDragStart = buildOnDragStart(result.current.handleDragStart);

    // 1) Recording drag activates
    act(() => {
      onDragStart(makeDragStartEvent({ id: 'recording-7' }));
    });
    expect(result.current.activeDragId).toBe('recording-7');

    // 2) Cancel
    act(() => {
      result.current.handleDragCancel();
    });
    expect(result.current.activeDragId).toBeNull();

    // 3) Workspace drag must NOT re-populate state
    act(() => {
      onDragStart(makeDragStartEvent({ id: 'ws-uuid-9', type: 'workspace' }));
    });
    expect(result.current.activeDragId).toBeNull();
    expect(result.current.draggedItems).toEqual([]);
  });
});
