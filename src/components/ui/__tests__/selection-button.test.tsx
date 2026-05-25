import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SelectionButton } from '../selection-button';

describe('SelectionButton', () => {
  it('renders label and icon', () => {
    render(
      <SelectionButton
        selected={false}
        icon={<span data-testid="icon">i</span>}
        label="Calls"
        onClick={() => {}}
      />,
    );
    expect(screen.getByText('Calls')).toBeInTheDocument();
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('applies canonical container classes when selected', () => {
    const { container } = render(
      <SelectionButton
        selected={true}
        icon={<span>i</span>}
        label="Calls"
        onClick={() => {}}
      />,
    );
    const btn = container.querySelector('button');
    expect(btn?.className).toContain('bg-muted');
    expect(btn?.className).toContain('border-border');
    expect(btn?.className).toContain('shadow-sm');
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(
      <SelectionButton
        selected={false}
        icon={<span>i</span>}
        label="Calls"
        onClick={onClick}
      />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders an anchor when as="a"', () => {
    const { container } = render(
      <SelectionButton
        selected={false}
        icon={<span>i</span>}
        label="Calls"
        as="a"
        href="/foo"
      />,
    );
    const a = container.querySelector('a');
    expect(a).toBeInTheDocument();
    expect(a?.getAttribute('href')).toBe('/foo');
  });

  it('renders description when provided', () => {
    render(
      <SelectionButton
        selected={false}
        icon={<span>i</span>}
        label="Calls"
        description="Your call library"
        onClick={() => {}}
      />,
    );
    expect(screen.getByText('Your call library')).toBeInTheDocument();
  });

  it('shows orange ring on icon container when selected', () => {
    const { container } = render(
      <SelectionButton
        selected={true}
        icon={<span data-testid="icon">i</span>}
        label="Calls"
        onClick={() => {}}
      />,
    );
    const iconContainer = container.querySelector('[aria-hidden="true"]');
    expect(iconContainer?.className).toContain('ring-vibe-orange');
    expect(iconContainer?.className).toContain('ring-1');
    expect(iconContainer?.className).toContain('bg-card');
  });

  it('renders rightSlot content after the label block', () => {
    render(
      <SelectionButton
        selected={true}
        icon={<span>i</span>}
        label="Plaud"
        rightSlot={<span>BETA</span>}
        onClick={() => {}}
      />,
    );
    expect(screen.getByText('BETA')).toBeInTheDocument();
  });

  it('renders horizontal orientation with bottom pill', () => {
    const { container } = render(
      <SelectionButton
        selected={true}
        icon={<span>i</span>}
        label="Overview"
        orientation="horizontal"
        onClick={() => {}}
      />,
    );
    const btn = container.querySelector('button');
    // before:bottom-0 is part of the horizontal+selected compound variant
    expect(btn?.className).toContain('before:bottom-0');
  });
});
