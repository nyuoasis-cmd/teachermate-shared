// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FocusTrap } from '../components/FocusTrap';

afterEach(() => {
  cleanup();
});

describe('FocusTrap', () => {
  it('focuses the first focusable element on mount', () => {
    render(
      <FocusTrap>
        <button>One</button>
        <button>Two</button>
      </FocusTrap>,
    );
    expect(document.activeElement).toBe(screen.getByText('One'));
  });

  it('wraps Tab from last back to first', () => {
    render(
      <FocusTrap>
        <button>One</button>
        <button>Two</button>
        <button>Three</button>
      </FocusTrap>,
    );
    const three = screen.getByText('Three');
    three.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByText('One'));
  });

  it('wraps Shift+Tab from first back to last', () => {
    render(
      <FocusTrap>
        <button>One</button>
        <button>Two</button>
        <button>Three</button>
      </FocusTrap>,
    );
    const one = screen.getByText('One');
    one.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(screen.getByText('Three'));
  });

  it('fires onEscape when ESC is pressed', () => {
    const onEscape = vi.fn();
    render(
      <FocusTrap onEscape={onEscape}>
        <button>One</button>
      </FocusTrap>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('restores focus on unmount by default', () => {
    const outside = document.createElement('button');
    outside.textContent = 'Outside';
    document.body.appendChild(outside);
    outside.focus();
    expect(document.activeElement).toBe(outside);

    const { unmount } = render(
      <FocusTrap>
        <button>Inside</button>
      </FocusTrap>,
    );
    expect(document.activeElement?.textContent).toBe('Inside');
    unmount();
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  it('skips focus trap behavior when active=false', () => {
    const onEscape = vi.fn();
    render(
      <FocusTrap active={false} onEscape={onEscape}>
        <button>One</button>
      </FocusTrap>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onEscape).not.toHaveBeenCalled();
  });

  it('initialFocus="container" focuses the container itself', () => {
    render(
      <FocusTrap initialFocus="container">
        <button>One</button>
      </FocusTrap>,
    );
    const container = document.querySelector('[data-focus-trap-active="true"]') as HTMLElement;
    expect(document.activeElement).toBe(container);
  });

  it('skips disabled buttons when computing wrap targets', () => {
    render(
      <FocusTrap>
        <button>One</button>
        <button disabled>Disabled</button>
        <button>Three</button>
      </FocusTrap>,
    );
    expect(document.activeElement?.textContent).toBe('One');
    screen.getByText('Three').focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement?.textContent).toBe('One');
  });
});
