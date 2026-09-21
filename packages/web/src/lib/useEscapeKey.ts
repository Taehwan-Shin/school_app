import { useEffect } from 'react';

// v0.203: Escape 키 눌림 시 handler 호출. popover/modal 닫기 등 접근성 개선.
// enabled=true 일 때만 리스너 부착 (닫힌 상태는 no-op).
export function useEscapeKey(handler: () => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const listener = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handler();
    };
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, [enabled, handler]);
}
