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

describe('VerdictGroup — generic options (5-3 확장)', () => {
  type CrossEase = 'easy' | 'difficult' | 'impossible';

  it('renders generic options with custom value types', () => {
    render(
      <VerdictGroup<CrossEase>
        name="cross-ease"
        value={null}
        onChange={() => {}}
        options={[
          { value: 'easy', label: '쉬워요', tone: 'success' },
          { value: 'difficult', label: '어려워요', tone: 'warning' },
          { value: 'impossible', label: '못 했어요', tone: 'danger' },
        ]}
      />,
    );
    const radios = screen.getAllByRole('radio');
    expect(radios.length).toBe(3);
    expect(radios[0].textContent).toBe('쉬워요');
    expect(radios[1].textContent).toBe('어려워요');
    expect(radios[2].textContent).toBe('못 했어요');
    expect(radios[0].getAttribute('data-value')).toBe('easy');
    expect(radios[0].getAttribute('data-tone')).toBe('success');
  });

  it('passes generic value through onChange', async () => {
    const onChange = vi.fn();
    render(
      <VerdictGroup<CrossEase>
        name="cross-ease"
        value={null}
        onChange={onChange}
        options={[
          { value: 'easy', label: '쉬워요', tone: 'success' },
          { value: 'difficult', label: '어려워요', tone: 'warning' },
          { value: 'impossible', label: '못 했어요', tone: 'danger' },
        ]}
      />,
    );
    await userEvent.click(screen.getByText('어려워요'));
    expect(onChange).toHaveBeenCalledWith('difficult');
  });

  it('supports neutral tone (4번째 옵션)', () => {
    type FourWay = 'a' | 'b' | 'c' | 'd';
    render(
      <VerdictGroup<FourWay>
        name="four"
        value="d"
        onChange={() => {}}
        options={[
          { value: 'a', label: '좋아요', tone: 'success' },
          { value: 'b', label: '괜찮아요', tone: 'warning' },
          { value: 'c', label: '별로예요', tone: 'danger' },
          { value: 'd', label: '잘 모르겠어요', tone: 'neutral' },
        ]}
      />,
    );
    const radios = screen.getAllByRole('radio');
    expect(radios.length).toBe(4);
    expect(radios[3].getAttribute('data-tone')).toBe('neutral');
    expect(radios[3].getAttribute('aria-checked')).toBe('true');
  });

  it('keyboard navigation works with generic options', () => {
    const onChange = vi.fn();
    type CrossEase = 'easy' | 'difficult' | 'impossible';
    render(
      <VerdictGroup<CrossEase>
        name="cross-ease"
        value="easy"
        onChange={onChange}
        options={[
          { value: 'easy', label: '쉬워요', tone: 'success' },
          { value: 'difficult', label: '어려워요', tone: 'warning' },
          { value: 'impossible', label: '못 했어요', tone: 'danger' },
        ]}
      />,
    );
    const radios = screen.getAllByRole('radio');
    radios[0].focus();
    fireEvent.keyDown(radios[0], { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('difficult');
  });
});
