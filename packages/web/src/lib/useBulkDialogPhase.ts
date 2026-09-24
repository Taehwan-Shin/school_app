// v0.281: bulk 다이얼로그 3-phase 상태 shared hook.
// 20+ site 반복되는 `phase` state + `handleOpenChange` 로직 통합.
//
// - `phase`: 'confirm' | 'running' | 'done'
// - `handleOpenChange`: 통일 rules
//   - running 중이면 close 차단 (사용자 실수로 도중 닫기 방지)
//   - done 에서 close 시 onDone 콜백 발화
//   - 그 외에는 부모 `onOpenChange` 그대로 전달
// - `onOpen?` (opt): dialog 가 열릴 때 caller-owned state 리셋용 콜백.
//   각 dialog 는 자기만의 state (failures/runEmails/confirmText 등) 를 여기서 초기화.
// v0.283: `onClose?` 추가. close 시 (running 아닌 상태) caller-owned cleanup.
//   BulkResetPassword F65 (평문 비밀번호 sensitive state 즉시 clear) 및
//   BulkArchive setConfirmText('') 같이 close 즉시 정리해야 하는 사이트 대응.
//   실행 순서: running 차단 → onClose?.() → done 시 onDone?.() → 부모 onOpenChange.
//
// 사용 예:
//   const { phase, setPhase, handleOpenChange } = useBulkDialogPhase({
//     open, onOpenChange, onDone,
//     onOpen: () => {
//       setProgress(0);
//       setFailures([]);
//       setConfirmText('');
//     },
//     onClose: () => {
//       setNewPassword('');  // sensitive
//     },
//   });

import { useEffect, useState } from 'react';

export type BulkDialogPhase = 'confirm' | 'running' | 'done';

export interface UseBulkDialogPhaseOptions {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
  onOpen?: () => void;
  onClose?: () => void;
}

export interface UseBulkDialogPhaseResult {
  phase: BulkDialogPhase;
  setPhase: (phase: BulkDialogPhase) => void;
  handleOpenChange: (newOpen: boolean) => void;
}

export function useBulkDialogPhase({
  open,
  onOpenChange,
  onDone,
  onOpen,
  onClose,
}: UseBulkDialogPhaseOptions): UseBulkDialogPhaseResult {
  const [phase, setPhase] = useState<BulkDialogPhase>('confirm');

  useEffect(() => {
    if (open) {
      setPhase('confirm');
      onOpen?.();
    }
    // onOpen 은 caller 가 매 렌더 새 함수를 넘길 수 있어 dep 에서 제외 (open 만 감시).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleOpenChange = (newOpen: boolean) => {
    if (phase === 'running') return;
    if (!newOpen) {
      onClose?.();
      if (phase === 'done') {
        onDone?.();
      }
    }
    onOpenChange(newOpen);
  };

  return { phase, setPhase, handleOpenChange };
}
