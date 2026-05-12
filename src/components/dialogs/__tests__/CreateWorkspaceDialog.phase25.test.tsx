/**
 * Phase 25 Nyquist coverage — WS-01 + WS-02.
 *
 * WS-01: "+ New Workspace" dialog has NO Workspace Type selector.
 * WS-02: Creating a workspace does NOT auto-create "Hall of Fame" or "Manager Reviews" folders.
 *
 * Behavioral edges:
 *   - Dialog renders with no element labeled "Workspace Type"
 *   - Dialog has no <SelectItem> for personal/team/youtube
 *   - Source-level invariant: useCreateWorkspace never inserts into the folders table
 *     and contains no "Hall of Fame" / "Manager Reviews" string
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as React from 'react';

const REPO_ROOT = resolve(__dirname, '../../../..');
function readSrc(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), 'utf-8');
}

const mockMutate = vi.fn();

vi.mock('@/hooks/useOrganizationContext', () => ({
  useOrganizationContext: () => ({
    organizations: [{ id: 'org-1', name: 'Workspace', type: 'business' }],
    activeOrgId: 'org-1',
  }),
}));

vi.mock('@/hooks/useWorkspaceMutations', () => ({
  useCreateWorkspace: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children, id }: { children: React.ReactNode; id?: string }) => (
    <p id={id}>{children}</p>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
    <label {...props}>{children}</label>
  ),
}));

vi.mock('@/components/ui/select', async () => {
  const React = await import('react');
  return {
    Select: ({ children }: { children: React.ReactNode }) => <div data-testid="select">{children}</div>,
    SelectTrigger: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
    SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder ?? ''}</span>,
    SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
      <button type="button" data-value={value}>
        {children}
      </button>
    ),
  };
});

import { CreateWorkspaceDialog } from '@/components/dialogs/CreateWorkspaceDialog';

describe('CreateWorkspaceDialog (WS-01) — no workspace-type selector', () => {
  beforeEach(() => {
    mockMutate.mockClear();
  });

  it('does NOT render any "Workspace Type" label', () => {
    render(<CreateWorkspaceDialog open onOpenChange={vi.fn()} orgId="org-1" />);
    expect(screen.queryByText(/workspace\s*type/i)).toBeNull();
  });

  it('does NOT render any SelectItem for personal/team/youtube workspace types', () => {
    render(<CreateWorkspaceDialog open onOpenChange={vi.fn()} orgId="org-1" />);
    // We mock SelectItem as a button with data-value=...
    const btns = document.querySelectorAll('button[data-value]');
    const values = Array.from(btns).map((b) => b.getAttribute('data-value'));
    expect(values).not.toContain('personal');
    expect(values).not.toContain('team');
    expect(values).not.toContain('youtube');
  });
});

describe('CreateWorkspaceDialog source (WS-01 invariant at the source)', () => {
  it('source has no "Workspace Type" label, no workspace-type SelectItem, no workspaceType state', () => {
    const src = readSrc('src/components/dialogs/CreateWorkspaceDialog.tsx');
    expect(src).not.toMatch(/Workspace\s+Type/);
    expect(src).not.toMatch(/SelectItem[^>]*value=["']personal["']/);
    expect(src).not.toMatch(/SelectItem[^>]*value=["']team["']/);
    expect(src).not.toMatch(/SelectItem[^>]*value=["']youtube["']/);
    expect(src).not.toMatch(/\buseState[^)]*workspaceType\b/);
    expect(src).not.toMatch(/setWorkspaceType\b/);
  });
});

describe('useCreateWorkspace (WS-02) — no auto-folders', () => {
  it('useCreateWorkspace source has no "Hall of Fame" or "Manager Reviews" string', () => {
    const src = readSrc('src/hooks/useWorkspaceMutations.ts');
    expect(src).not.toMatch(/Hall of Fame/i);
    expect(src).not.toMatch(/Manager Reviews/i);
  });

  it('useCreateWorkspace body does not insert into the folders table on creation', () => {
    const src = readSrc('src/hooks/useWorkspaceMutations.ts');
    const startIdx = src.indexOf('export function useCreateWorkspace');
    expect(startIdx).toBeGreaterThan(-1);
    const nextExportIdx = src.indexOf('export function ', startIdx + 1);
    const body = src.slice(startIdx, nextExportIdx === -1 ? undefined : nextExportIdx);
    expect(body).not.toMatch(/\.from\(\s*['"]folders['"]\s*\)/);
  });
});

describe('Phase 25 invariant — auto-folder strings purged from workspace UI surfaces', () => {
  it('no targeted source file contains "Hall of Fame" or "Manager Reviews"', () => {
    const checked = [
      'src/hooks/useWorkspaceMutations.ts',
      'src/hooks/useWorkspaces.ts',
      'src/components/dialogs/CreateWorkspaceDialog.tsx',
      'src/components/panes/WorkspaceSidebarPane.tsx',
    ];
    for (const f of checked) {
      const src = readSrc(f);
      expect(src, `${f} contains "Hall of Fame"`).not.toMatch(/Hall of Fame/i);
      expect(src, `${f} contains "Manager Reviews"`).not.toMatch(/Manager Reviews/i);
    }
  });
});

// Phase 36-04 BUG-08 extension — broaden the regression net beyond Phase 25.
// Org-creation, signup, onboarding, and Edge Functions must also be clean.
describe('Phase 36-04 BUG-08 — no auto-folder seeders on org-creation / onboarding', () => {
  it('useOrganizationMutations source has no "Hall of Fame" or "Manager Reviews" string', () => {
    const src = readSrc('src/hooks/useOrganizationMutations.ts');
    expect(src).not.toMatch(/Hall of Fame/i);
    expect(src).not.toMatch(/Manager Reviews/i);
  });

  it('CreateOrganizationDialog source has no auto-folder string', () => {
    const src = readSrc('src/components/dialogs/CreateOrganizationDialog.tsx');
    expect(src).not.toMatch(/Hall of Fame/i);
    expect(src).not.toMatch(/Manager Reviews/i);
  });

  it('no Edge Function in supabase/functions/ contains the auto-folder strings', () => {
    const path = require('path');
    const fs = require('fs');
    const funcsDir = path.resolve(process.cwd(), 'supabase/functions');
    if (!fs.existsSync(funcsDir)) return; // nothing to check

    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          walk(full);
        } else if (full.endsWith('.ts') || full.endsWith('.js')) {
          const body = fs.readFileSync(full, 'utf8');
          if (/Hall of Fame/i.test(body) || /Manager Reviews/i.test(body)) {
            offenders.push(full);
          }
        }
      }
    };
    walk(funcsDir);
    expect(offenders, `auto-folder seeders found: ${offenders.join(', ')}`).toEqual([]);
  });
});
