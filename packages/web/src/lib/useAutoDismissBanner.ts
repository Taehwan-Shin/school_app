import { useCallback, useEffect, useRef, useState } from 'react';

// v0.226: 「선호 초기화 완료」 같은 성공 배너 → 지정 시간 뒤 자동 dismiss.
// - `show(message, ms?)`: message 저장 + `ms` 후 자동 null. `ms` 기본 2000.
// - `clear()`: 즉시 dismiss.
// - unmount 시 pending timer 자동 정리 → React setState-on-unmounted 경고 방지.
// - 재호출 (중복 show) 시 이전 timer 취소 · 새 timer 로 대체.
export function useAutoDismissBanner(): {
  message: string | null;
  show: (msg: string, ms?: number) => void;
  clear: () => void;
} {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clear = useCallback(() => {
    clearTimer();
    setMessage(null);
  }, [clearTimer]);

  const show = useCallback(
    (msg: string, ms = 2000) => {
      clearTimer();
      setMessage(msg);
      timerRef.current = setTimeout(() => {
        setMessage(null);
        timerRef.current = null;
      }, ms);
    },
    [clearTimer],
  );

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  return { message, show, clear };
}
