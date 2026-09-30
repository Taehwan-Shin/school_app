import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePhasedDialog } from '../src/lib/usePhasedDialog';

type P = 'confirm' | 'scanning' | 'preview' | 'running' | 'done';
const LOCKED: readonly P[] = ['scanning', 'running'];

function setup(props: { open: boolean; resetKey?: unknown }, extra: Partial<Parameters<typeof usePhasedDialog<P>>[0]> = {}) {
  const onOpenChange = vi.fn();
  const hook = renderHook(
    ({ open, resetKey }) =>
      usePhasedDialog<P>({
        open,
        onOpenChange,
        initialPhase: 'confirm',
        lockedPhases: LOCKED,
        donePhase: 'done',
        resetKey,
        ...extra,
      }),
    { initialProps: props },
  );
  return { ...hook, onOpenChange };
}

describe('usePhasedDialog (v0.317)', () => {
  it('초기 phase = initialPhase · open 시 리셋 + onOpen 1회', () => {
    const onOpen = vi.fn();
    const { result, rerender } = setup({ open: false }, { onOpen });
    expect(result.current.phase).toBe('confirm');
    act(() => result.current.setPhase('preview'));
    rerender({ open: true });
    expect(result.current.phase).toBe('confirm');
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('lockedPhases 전부 close/open 차단 (scanning · running)', () => {
    const onClose = vi.fn();
    const { result, onOpenChange } = setup({ open: true }, { onClose });
    for (const locked of LOCKED) {
      act(() => result.current.setPhase(locked));
      act(() => result.current.handleOpenChange(false));
    }
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('비 locked phase (preview) close → onClose → 부모 onOpenChange(false) · onDone 미호출', () => {
    const onClose = vi.fn();
    const onDone = vi.fn();
    const { result, onOpenChange } = setup({ open: true }, { onClose, onDone });
    act(() => result.current.setPhase('preview'));
    act(() => result.current.handleOpenChange(false));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('donePhase 에서 close → onClose → onDone → 부모 순서', () => {
    const calls: string[] = [];
    const { result, onOpenChange } = setup(
      { open: true },
      { onClose: () => calls.push('close'), onDone: () => calls.push('done') },
    );
    onOpenChange.mockImplementation(() => calls.push('parent'));
    act(() => result.current.setPhase('done'));
    act(() => result.current.handleOpenChange(false));
    expect(calls).toEqual(['close', 'done', 'parent']);
  });

  it('donePhase 미지정 → done 에서 close 해도 onDone 미호출', () => {
    const onDone = vi.fn();
    const { result } = setup({ open: true }, { onDone, donePhase: undefined });
    act(() => result.current.setPhase('done'));
    act(() => result.current.handleOpenChange(false));
    expect(onDone).not.toHaveBeenCalled();
  });

  it('resetKey 변경 (open 유지) → 다시 리셋 + onOpen 재호출 · 동일 key 는 무반응', () => {
    const onOpen = vi.fn();
    const { result, rerender } = setup({ open: true, resetKey: 'spaces/A' }, { onOpen });
    expect(onOpen).toHaveBeenCalledTimes(1);
    act(() => result.current.setPhase('preview'));
    rerender({ open: true, resetKey: 'spaces/A' });
    expect(result.current.phase).toBe('preview');
    expect(onOpen).toHaveBeenCalledTimes(1);
    rerender({ open: true, resetKey: 'spaces/B' });
    expect(result.current.phase).toBe('confirm');
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it('resetKey 변경이라도 open=false 면 리셋 안 함', () => {
    const onOpen = vi.fn();
    const { result, rerender } = setup({ open: false, resetKey: 1 }, { onOpen });
    act(() => result.current.setPhase('preview'));
    rerender({ open: false, resetKey: 2 });
    expect(result.current.phase).toBe('preview');
    expect(onOpen).not.toHaveBeenCalled();
  });
});
