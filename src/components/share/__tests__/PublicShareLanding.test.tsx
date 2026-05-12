import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PublicShareLanding } from '../PublicShareLanding';

describe('PublicShareLanding', () => {
  const baseProps = {
    inviterName: 'Andrew N.',
    callTitle: 'Q3 Sales Sync',
    token: 'test-token-abc',
    onSignUp: vi.fn(),
    onOpenExisting: vi.fn(),
  };

  it('renders the inviter name and call title from props', () => {
    render(<PublicShareLanding {...baseProps} />);
    expect(screen.getByText('Andrew N. shared a call with you')).toBeInTheDocument();
    expect(screen.getByText('Q3 Sales Sync')).toBeInTheDocument();
  });

  it('renders the locked Sign up to view primary CTA', () => {
    render(<PublicShareLanding {...baseProps} />);
    expect(screen.getByRole('button', { name: /Sign up to view/i })).toBeInTheDocument();
  });

  it('renders the locked Open in existing account secondary CTA', () => {
    render(<PublicShareLanding {...baseProps} />);
    expect(screen.getByRole('button', { name: /Open in existing account/i })).toBeInTheDocument();
  });

  it('renders the Free tier helper text', () => {
    render(<PublicShareLanding {...baseProps} />);
    expect(screen.getByText(/Free tier — no credit card needed/i)).toBeInTheDocument();
  });

  it('fires onSignUp when the primary CTA is clicked', async () => {
    const onSignUp = vi.fn();
    render(<PublicShareLanding {...baseProps} onSignUp={onSignUp} />);
    await userEvent.click(screen.getByRole('button', { name: /Sign up to view/i }));
    expect(onSignUp).toHaveBeenCalledTimes(1);
  });

  it('fires onOpenExisting when the secondary CTA is clicked', async () => {
    const onOpenExisting = vi.fn();
    render(<PublicShareLanding {...baseProps} onOpenExisting={onOpenExisting} />);
    await userEvent.click(screen.getByRole('button', { name: /Open in existing account/i }));
    expect(onOpenExisting).toHaveBeenCalledTimes(1);
  });
});
