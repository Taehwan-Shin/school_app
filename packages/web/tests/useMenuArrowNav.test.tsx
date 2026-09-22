import React, { useRef } from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { useMenuArrowNav } from '../src/lib/useMenuArrowNav';

function TestContainer({ enabled }: { enabled: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useMenuArrowNav(ref, enabled);
  return (
    <div>
      <button data-testid="outside-before">outside-before</button>
      <div ref={ref} data-testid="container">
        <button data-testid="a">A</button>
        <button data-testid="b">B</button>
        <button data-testid="c">C</button>
      </div>
      <button data-testid="outside-after">outside-after</button>
    </div>
  );
}

// v0.218: WAI-ARIA menu 방향키 탐색 (Up/Down/Home/End).
describe('useMenuArrowNav', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('ArrowDown: 다음 focusable 로 이동', () => {
    render(<TestContainer enabled={true} />);
    (document.querySelector('[data-testid="a"]') as HTMLElement).focus();
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    expect(document.activeElement?.getAttribute('data-testid')).toBe('b');
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    expect(document.activeElement?.getAttribute('data-testid')).toBe('c');
  });

  it('ArrowDown 마지막 → 첫 번째로 wrap', () => {
    render(<TestContainer enabled={true} />);
    (document.querySelector('[data-testid="c"]') as HTMLElement).focus();
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    expect(document.activeElement?.getAttribute('data-testid')).toBe('a');
  });

  it('ArrowUp: 이전 focusable 로 이동', () => {
    render(<TestContainer enabled={true} />);
    (document.querySelector('[data-testid="c"]') as HTMLElement).focus();
    fireEvent.keyDown(document, { key: 'ArrowUp' });
    expect(document.activeElement?.getAttribute('data-testid')).toBe('b');
  });

  it('ArrowUp 첫 번째 → 마지막으로 wrap', () => {
    render(<TestContainer enabled={true} />);
    (document.querySelector('[data-testid="a"]') as HTMLElement).focus();
    fireEvent.keyDown(document, { key: 'ArrowUp' });
    expect(document.activeElement?.getAttribute('data-testid')).toBe('c');
  });

  it('Home: 첫 번째로 이동 · End: 마지막으로 이동', () => {
    render(<TestContainer enabled={true} />);
    (document.querySelector('[data-testid="b"]') as HTMLElement).focus();
    fireEvent.keyDown(document, { key: 'Home' });
    expect(document.activeElement?.getAttribute('data-testid')).toBe('a');
    fireEvent.keyDown(document, { key: 'End' });
    expect(document.activeElement?.getAttribute('data-testid')).toBe('c');
  });

  it('enabled=false → 방향키 무시', () => {
    render(<TestContainer enabled={false} />);
    (document.querySelector('[data-testid="a"]') as HTMLElement).focus();
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    // focus 그대로.
    expect(document.activeElement?.getAttribute('data-testid')).toBe('a');
  });

  it('disabled focusable 은 건너뛴다', () => {
    function DisabledContainer() {
      const ref = useRef<HTMLDivElement>(null);
      useMenuArrowNav(ref, true);
      return (
        <div ref={ref}>
          <button data-testid="a">A</button>
          <button data-testid="b" disabled>B</button>
          <button data-testid="c">C</button>
        </div>
      );
    }
    render(<DisabledContainer />);
    (document.querySelector('[data-testid="a"]') as HTMLElement).focus();
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    // B 는 disabled → C 로.
    expect(document.activeElement?.getAttribute('data-testid')).toBe('c');
  });

  it('다른 키 (Space/Tab) 는 무시 (preventDefault 안 함)', () => {
    render(<TestContainer enabled={true} />);
    (document.querySelector('[data-testid="a"]') as HTMLElement).focus();
    const preventedDown = fireEvent.keyDown(document, { key: 'ArrowDown' });
    expect(preventedDown).toBe(false); // preventDefault 호출됨 → return false.
    const notPreventedTab = fireEvent.keyDown(document, { key: 'Tab' });
    expect(notPreventedTab).toBe(true); // 그대로 통과.
  });
});
