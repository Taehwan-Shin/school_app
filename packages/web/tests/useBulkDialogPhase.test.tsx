import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBulkDialogPhase } from '../src/lib/useBulkDialogPhase';

describe('useBulkDialogPhase (v0.281)', () => {
  it('초기 phase 는 "confirm"', () => {
    const { result } = renderHook(() =>
      useBulkDialogPhase({ open: false, onOpenChange: vi.fn() }),
    );
    expect(result.current.phase).toBe('confirm');
  });

  it('open=true → onOpen 콜백 호출 + phase reset to "confirm"', () => {
    const onOpen = vi.fn();
    const { result, rerender } = renderHook(
      ({ open }) => useBulkDialogPhase({ open, onOpenChange: vi.fn(), onOpen }),
      { initialProps: { open: false } },
    );
    // running 으로 진행 시켰다가 재 open 시 confirm 리셋 되는지 확인.
    act(() => result.current.setPhase('running'));
    expect(result.current.phase).toBe('running');
    rerender({ open: true });
    expect(result.current.phase).toBe('confirm');
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('open=false → onOpen 미호출', () => {
    const onOpen = vi.fn();
    renderHook(() =>
      useBulkDialogPhase({ open: false, onOpenChange: vi.fn(), onOpen }),
    );
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('handleOpenChange · confirm phase 에서 close 시 부모 onOpenChange 그대로 전달', () => {
    const onOpenChange = vi.fn();
    const { result } = renderHook(() =>
      useBulkDialogPhase({ open: true, onOpenChange }),
    );
    act(() => result.current.handleOpenChange(false));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('handleOpenChange · running phase 에서 close 차단 (onOpenChange 미호출)', () => {
    const onOpenChange = vi.fn();
    const { result } = renderHook(() =>
      useBulkDialogPhase({ open: true, onOpenChange }),
    );
    act(() => result.current.setPhase('running'));
    act(() => result.current.handleOpenChange(false));
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('handleOpenChange · done phase 에서 close → onDone 발화 + onOpenChange', () => {
    const onOpenChange = vi.fn();
    const onDone = vi.fn();
    const { result } = renderHook(() =>
      useBulkDialogPhase({ open: true, onOpenChange, onDone }),
    );
    act(() => result.current.setPhase('done'));
    act(() => result.current.handleOpenChange(false));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('handleOpenChange · done phase 에서 open=true 전달 시 onDone 미호출', () => {
    const onDone = vi.fn();
    const { result } = renderHook(() =>
      useBulkDialogPhase({ open: true, onOpenChange: vi.fn(), onDone }),
    );
    act(() => result.current.setPhase('done'));
    act(() => result.current.handleOpenChange(true));
    expect(onDone).not.toHaveBeenCalled();
  });

  it('handleOpenChange · onDone 미지정 시 done close 안전', () => {
    const onOpenChange = vi.fn();
    const { result } = renderHook(() =>
      useBulkDialogPhase({ open: true, onOpenChange }),
    );
    act(() => result.current.setPhase('done'));
    expect(() => act(() => result.current.handleOpenChange(false))).not.toThrow();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
