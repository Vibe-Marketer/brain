import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WrongAccountState } from '../WrongAccountState';

describe('WrongAccountState', () => {
  const baseProps = {
    recipientMasked: 'na***@gmail.com',
    onSignOut: vi.fn(),
    onCancel: vi.fn(),
    isSigningOut: false,
  };

  it('renders the locked heading copy', () => {
    render(<WrongAccountState {...baseProps} />);
    expect(screen.getByText('This share is for a different account')).toBeInTheDocument();
  });

  it('renders the masked email in the body paragraph', () => {
    render(<WrongAccountState {...baseProps} />);
    expect(screen.getByText(/na\*\*\*@gmail\.com/)).toBeInTheDocument();
  });

  it('renders the fallback body copy when recipientMasked is null', () => {
    render(<WrongAccountState {...baseProps} recipientMasked={null} />);
    expect(screen.getByText(/a different email/)).toBeInTheDocument();
  });

  it('shows "Signing out..." when isSigningOut is true', () => {
    render(<WrongAccountState {...baseProps} isSigningOut={true} />);
    expect(screen.getByRole('button', { name: /Signing out/i })).toBeInTheDocument();
  });

  it('disables both buttons when isSigningOut is true', () => {
    render(<WrongAccountState {...baseProps} isSigningOut={true} />);
    expect(screen.getByRole('button', { name: /Signing out/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeDisabled();
  });

  it('fires onSignOut when Sign out is clicked', async () => {
    const onSignOut = vi.fn();
    render(<WrongAccountState {...baseProps} onSignOut={onSignOut} />);
    await userEvent.click(screen.getByRole('button', { name: /^Sign out$/i }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it('fires onCancel when Cancel is clicked', async () => {
    const onCancel = vi.fn();
    render(<WrongAccountState {...baseProps} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('auto-focuses the Sign out button on mount', () => {
    render(<WrongAccountState {...baseProps} />);
    expect(screen.getByRole('button', { name: /^Sign out$/i })).toHaveFocus();
  });
});
