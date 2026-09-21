import React, { useRef } from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { useFocusTrap } from '../src/lib/useFocusTrap';

function TestContainer({ enabled }: { enabled: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, enabled);
  return (
    <div>
      <button data-testid="outside-before">outside-before</button>
      <div ref={ref} data-testid="container">
        <button data-testid="inside-a">A</button>
        <button data-testid="inside-b">B</button>
        <button data-testid="inside-c">C</button>
      </div>
      <button data-testid="outside-after">outside-after</button>
    </div>
  );
}

describe('useFocusTrap', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('enabled=true 시 컨테이너 첫 focusable 로 focus 이동', () => {
    render(<TestContainer enabled={true} />);
    expect(document.activeElement?.getAttribute('data-testid')).toBe('inside-a');
  });

  it('enabled=false 시 자동 focus 이동 없음', () => {
    render(<TestContainer enabled={false} />);
    expect(document.activeElement?.getAttribute('data-testid')).not.toBe('inside-a');
  });

  it('마지막 focusable 에서 Tab → 첫 focusable 로 wrap', () => {
    const { getByTestId } = render(<TestContainer enabled={true} />);
    // 수동으로 마지막에 focus.
    (getByTestId('inside-c') as HTMLButtonElement).focus();
    expect(document.activeElement?.getAttribute('data-testid')).toBe('inside-c');
    // Tab → 첫 요소로 wrap.
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement?.getAttribute('data-testid')).toBe('inside-a');
  });

  it('첫 focusable 에서 Shift+Tab → 마지막 focusable 로 wrap', () => {
    const { getByTestId } = render(<TestContainer enabled={true} />);
    (getByTestId('inside-a') as HTMLButtonElement).focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement?.getAttribute('data-testid')).toBe('inside-c');
  });
});
