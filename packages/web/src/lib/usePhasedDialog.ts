// v0.317: N-phase 다이얼로그 상태 shared hook (useBulkDialogPhase 일반화).
// v0.281 useBulkDialogPhase 는 'confirm' | 'running' | 'done' 3-phase 고정이라
// 4-phase (select → preview → running → done) · 5-phase (confirm → scanning → preview → running → done)
// · ImportBasicData (select → preview → saving → done) 9 site 가 같은 로직을 손으로 반복했다.
//
// - `initialPhase`: open 시 리셋할 phase.
// - `lockedPhases`: 이 phase 동안 close 차단 (running/scanning/saving 등 도중 닫기 방지).
// - `donePhase?`: 이 phase 에서 close 시 onDone 발화.
// - `resetKey?`: open 유지 중 대상이 바뀌면 (예: spaceName · courseId) 다시 리셋.
// - `onOpen?` / `onClose?` / `onDone?`: useBulkDialogPhase 와 동일 의미.
//   실행 순서: locked 차단 → onClose?.() → donePhase 시 onDone?.() → 부모 onOpenChange.

import { useEffect, useState } from 'react';

export interface UsePhasedDialogOptions<P extends string> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPhase: P;
  lockedPhases: readonly P[];
  donePhase?: P;
  resetKey?: unknown;
  onDone?: () => void;
  onOpen?: () => void;
  onClose?: () => void;
}

export interface UsePhasedDialogResult<P extends string> {
  phase: P;
  setPhase: (phase: P) => void;
  handleOpenChange: (newOpen: boolean) => void;
}

export function usePhasedDialog<P extends string>({
  open,
  onOpenChange,
  initialPhase,
  lockedPhases,
  donePhase,
  resetKey,
  onDone,
  onOpen,
  onClose,
}: UsePhasedDialogOptions<P>): UsePhasedDialogResult<P> {
  const [phase, setPhase] = useState<P>(initialPhase);

  useEffect(() => {
    if (open) {
      setPhase(initialPhase);
      onOpen?.();
    }
    // onOpen/initialPhase 는 caller 가 매 렌더 새 값을 넘길 수 있어 dep 에서 제외 (open · resetKey 만 감시).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, resetKey]);

  const handleOpenChange = (newOpen: boolean) => {
    if (lockedPhases.includes(phase)) return;
    if (!newOpen) {
      onClose?.();
      if (donePhase !== undefined && phase === donePhase) {
        onDone?.();
      }
    }
    onOpenChange(newOpen);
  };

  return { phase, setPhase, handleOpenChange };
}
