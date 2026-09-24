import { describe, it, expect } from 'vitest';
import { cn } from '../src/lib/utils';

// v0.286: `cn()` (tailwind-merge + clsx) 회귀. v0.9x 에서 tailwind-merge
// 기본 설정이 UI_SYSTEM 커스텀 토큰 (`text-accent-on-primary` color vs
// `text-body` font-size) 을 같은 group 으로 오인 → 색상 클래스 유실 → Primary
// Button 검정 배경 + 검정 텍스트 렌더 버그. utils.ts 는 `extendTailwindMerge`
// 로 커스텀 color/font-size 토큰 등록. 이 파일은 그 계약을 지키는 회귀 방어망.

describe('cn (v0.286 · utils.ts)', () => {
  it('여러 클래스 병합 · falsy 무시 (clsx 동작)', () => {
    expect(cn('a', 'b')).toBe('a b');
    expect(cn('a', false, null, undefined, 'b')).toBe('a b');
    expect(cn('a', { b: true, c: false })).toBe('a b');
  });

  it('표준 tailwind 충돌 병합 (마지막 클래스가 win)', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
    expect(cn('bg-white', 'bg-black')).toBe('bg-black');
  });

  it('UI_SYSTEM 커스텀 color 토큰 병합 (bg-canvas/surface/elevated 등)', () => {
    // 커스텀 color 는 표준 color 와 같은 group 으로 인식돼야 함.
    expect(cn('bg-canvas', 'bg-surface')).toBe('bg-surface');
    expect(cn('text-fg-primary', 'text-fg-secondary')).toBe('text-fg-secondary');
    expect(cn('border-border-subtle', 'border-border-strong')).toBe('border-border-strong');
  });

  it('UI_SYSTEM state 색상 병합 (state-danger/success/warning)', () => {
    expect(cn('text-state-danger', 'text-state-success')).toBe('text-state-success');
    expect(cn('bg-state-warning', 'bg-state-danger')).toBe('bg-state-danger');
    expect(cn('border-state-success', 'border-state-warning')).toBe('border-state-warning');
  });

  it('UI_SYSTEM accent 색상 병합', () => {
    expect(cn('bg-accent-primary', 'bg-canvas')).toBe('bg-canvas');
    expect(cn('text-accent-on-primary', 'text-fg-primary')).toBe('text-fg-primary');
  });

  it('**핵심 회귀**: 커스텀 color + 커스텀 font-size 는 다른 group 이라 공존 (bug 방지)', () => {
    // v0.9x 버그: 기본 tailwind-merge 는 `text-accent-on-primary` (color) 와
    // `text-body` (font-size) 를 같은 text-* group 으로 오인 → 하나 삭제.
    // extendTailwindMerge 로 font-size 를 별도 group 으로 등록해 공존 보장.
    const result = cn('text-accent-on-primary', 'text-body');
    // 두 클래스 모두 유지되어야 함 (색상은 accent-on-primary, 크기는 body).
    expect(result).toContain('text-accent-on-primary');
    expect(result).toContain('text-body');
  });

  it('커스텀 font-size 여러 개 → 마지막이 win (같은 group)', () => {
    expect(cn('text-body', 'text-h1')).toBe('text-h1');
    expect(cn('text-small', 'text-micro')).toBe('text-micro');
    expect(cn('text-h2', 'text-h3', 'text-display')).toBe('text-display');
  });

  it('색상 클래스 + font-size 클래스 조합 (Primary Button 회귀)', () => {
    // Primary Button 은 accent 색 + body 폰트 크기 + 배경 등을 함께 씀.
    const result = cn(
      'bg-accent-primary',
      'text-accent-on-primary',
      'text-body',
      'font-bold',
      'px-4',
      'py-2',
    );
    // 모든 클래스 유지 (색·크기·굵기·padding).
    expect(result).toContain('bg-accent-primary');
    expect(result).toContain('text-accent-on-primary');
    expect(result).toContain('text-body');
    expect(result).toContain('font-bold');
    expect(result).toContain('px-4');
    expect(result).toContain('py-2');
  });

  it('nested arrays / objects (clsx 재귀 처리)', () => {
    expect(cn(['a', ['b', 'c']])).toBe('a b c');
    expect(cn({ a: true }, ['b', { c: true, d: false }])).toBe('a b c');
  });

  it('빈 인자 → 빈 문자열', () => {
    expect(cn()).toBe('');
    expect(cn(null, undefined, false)).toBe('');
  });
});
