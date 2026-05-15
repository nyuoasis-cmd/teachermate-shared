// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VerdictGroup } from '../components/VerdictGroup';

afterEach(() => {
  cleanup();
});

describe('VerdictGroup', () => {
  it('renders three radio buttons with default Korean labels', () => {
    render(<VerdictGroup name="qa-1" value={null} onChange={() => {}} />);
    const radios = screen.getAllByRole('radio');
    expect(radios.length).toBe(3);
    expect(radios[0].textContent).toBe('작동함');
    expect(radios[1].textContent).toBe('되긴 하는데…');
    expect(radios[2].textContent).toBe('안 됨');
  });

  it('uses custom labels when provided', () => {
    render(
      <VerdictGroup
        name="design-1"
        value={null}
        onChange={() => {}}
        labels={{ pass: '좋아요', partial: '애매해요', fail: '별로예요' }}
      />,
    );
    expect(screen.getByText('좋아요')).toBeTruthy();
    expect(screen.getByText('애매해요')).toBeTruthy();
    expect(screen.getByText('별로예요')).toBeTruthy();
  });

  it('marks aria-checked true on the selected value', () => {
    render(<VerdictGroup name="qa-1" value="partial" onChange={() => {}} />);
    const radios = screen.getAllByRole('radio');
    expect(radios[0].getAttribute('aria-checked')).toBe('false');
    expect(radios[1].getAttribute('aria-checked')).toBe('true');
    expect(radios[2].getAttribute('aria-checked')).toBe('false');
  });

  it('makes only the selected button focusable (tabindex 0)', () => {
    render(<VerdictGroup name="qa-1" value="fail" onChange={() => {}} />);
    const radios = screen.getAllByRole('radio');
    expect(radios[0].getAttribute('tabindex')).toBe('-1');
    expect(radios[1].getAttribute('tabindex')).toBe('-1');
    expect(radios[2].getAttribute('tabindex')).toBe('0');
  });

  it('makes the first button focusable when value is null', () => {
    render(<VerdictGroup name="qa-1" value={null} onChange={() => {}} />);
    const radios = screen.getAllByRole('radio');
    expect(radios[0].getAttribute('tabindex')).toBe('0');
  });

  it('calls onChange when a radio is clicked', async () => {
    const onChange = vi.fn();
    render(<VerdictGroup name="qa-1" value={null} onChange={onChange} />);
    await userEvent.click(screen.getByText('작동함'));
    expect(onChange).toHaveBeenCalledWith('pass');
  });

  it('navigates with ArrowRight (pass → partial → fail → pass)', () => {
    const onChange = vi.fn();
    render(<VerdictGroup name="qa-1" value="pass" onChange={onChange} />);
    const radios = screen.getAllByRole('radio');
    radios[0].focus();
    fireEvent.keyDown(radios[0], { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('partial');
  });

  it('wraps from fail to pass on ArrowRight', () => {
    const onChange = vi.fn();
    render(<VerdictGroup name="qa-1" value="fail" onChange={onChange} />);
    const radios = screen.getAllByRole('radio');
    radios[2].focus();
    fireEvent.keyDown(radios[2], { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('pass');
  });

  it('navigates backward with ArrowLeft', () => {
    const onChange = vi.fn();
    render(<VerdictGroup name="qa-1" value="partial" onChange={onChange} />);
    const radios = screen.getAllByRole('radio');
    radios[1].focus();
    fireEvent.keyDown(radios[1], { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith('pass');
  });

  it('ArrowDown also navigates forward (vertical fallback)', () => {
    const onChange = vi.fn();
    render(<VerdictGroup name="qa-1" value="pass" onChange={onChange} />);
    const radios = screen.getAllByRole('radio');
    radios[0].focus();
    fireEvent.keyDown(radios[0], { key: 'ArrowDown' });
    expect(onChange).toHaveBeenLastCalledWith('partial');
  });

  it('Home jumps to pass, End jumps to fail', () => {
    const onChange = vi.fn();
    render(<VerdictGroup name="qa-1" value="partial" onChange={onChange} />);
    const radios = screen.getAllByRole('radio');
    radios[1].focus();
    fireEvent.keyDown(radios[1], { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith('pass');
    fireEvent.keyDown(radios[1], { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith('fail');
  });

  it('does not call onChange when disabled', async () => {
    const onChange = vi.fn();
    render(<VerdictGroup name="qa-1" value={null} onChange={onChange} disabled />);
    await userEvent.click(screen.getByText('작동함'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('exposes data-name for form/group identification', () => {
    render(<VerdictGroup name="qa-card-2" value={null} onChange={() => {}} />);
    const radios = screen.getAllByRole('radio');
    radios.forEach((r) => expect(r.getAttribute('data-name')).toBe('qa-card-2'));
  });

  it('applies ariaLabel to the radiogroup', () => {
    render(<VerdictGroup name="qa-1" value={null} onChange={() => {}} ariaLabel="기능 작동 확인" />);
    expect(screen.getByRole('radiogroup').getAttribute('aria-label')).toBe('기능 작동 확인');
  });
});
