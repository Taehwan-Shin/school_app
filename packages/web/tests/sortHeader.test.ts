import { describe, it, expect, vi } from 'vitest';
import { sortHeaderKbdProps } from '../src/routes/admin/sortHeader';

// v0.139: v0.138 에서 도입된 sortHeaderKbdProps helper 단위 테스트
// (Codex v0.138 소프트 권고 반영).
// 3화면 (ClassroomTable · AccountsTable · GroupsTable) integration 테스트가
// 실 DOM 에서 트리거 결과를 확인하지만, helper 자체의 계약 (Enter/Space 만
// preventDefault + activate · 다른 키 무시 · 반환값 shape) 은 단위로 고정.

function makeKbdEvent(key: string) {
  const preventDefault = vi.fn();
  return {
    event: { key, preventDefault } as unknown as React.KeyboardEvent<HTMLTableCellElement>,
    preventDefault,
  };
}

describe('sortHeaderKbdProps', () => {
  it('returns tabIndex=0 and focus-visible ring className', () => {
    const props = sortHeaderKbdProps(() => {});
    expect(props.tabIndex).toBe(0);
    expect(props.className).toContain('cursor-pointer');
    expect(props.className).toContain('select-none');
    expect(props.className).toContain('focus-visible:ring');
  });

  it('appends extraClassName when provided (trimmed)', () => {
    const props = sortHeaderKbdProps(() => {}, 'text-right');
    expect(props.className.endsWith('text-right')).toBe(true);
    // extraClassName 없이 호출하면 trailing space 없음.
    const props2 = sortHeaderKbdProps(() => {});
    expect(props2.className).toBe(props2.className.trim());
  });

  it('Enter 는 preventDefault 후 onActivate 호출', () => {
    const onActivate = vi.fn();
    const { event, preventDefault } = makeKbdEvent('Enter');
    sortHeaderKbdProps(onActivate).onKeyDown(event);
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('Space 는 preventDefault 후 onActivate 호출', () => {
    const onActivate = vi.fn();
    const { event, preventDefault } = makeKbdEvent(' ');
    sortHeaderKbdProps(onActivate).onKeyDown(event);
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('다른 키 (Tab · a · Escape · ArrowDown) 는 preventDefault · onActivate 모두 미호출', () => {
    for (const key of ['Tab', 'a', 'Escape', 'ArrowDown', 'A', '1']) {
      const onActivate = vi.fn();
      const { event, preventDefault } = makeKbdEvent(key);
      sortHeaderKbdProps(onActivate).onKeyDown(event);
      expect(preventDefault, `key=${key}`).not.toHaveBeenCalled();
      expect(onActivate, `key=${key}`).not.toHaveBeenCalled();
    }
  });

  it('반환 객체 shape 은 { tabIndex, onKeyDown, className } 세 필드', () => {
    const props = sortHeaderKbdProps(() => {});
    expect(Object.keys(props).sort()).toEqual(['className', 'onKeyDown', 'tabIndex']);
  });
});
