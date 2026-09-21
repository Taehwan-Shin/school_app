import { useEffect, type RefObject } from 'react';

// v0.202: popover/menu 등 UI 요소가 「외부 클릭 시 닫힘」 동작을 갖도록 하는 hook.
// 조건: enabled=true 일 때만 리스너 부착 (닫힌 상태에서는 no-op → 성능).
// - mousedown 을 씀 (click 은 이미 blur 상태에서 발화, mousedown 이 UX 상 자연스러움).
// - refs 배열 지원 → trigger 버튼 + 메뉴 컨테이너 둘 다 「내부」 로 취급 가능.
export function useClickOutside(
  refs: RefObject<HTMLElement>[],
  handler: () => void,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return;
    const listener = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      // 어느 하나라도 내부면 「내부 클릭」 → 무시.
      for (const ref of refs) {
        if (ref.current && ref.current.contains(target)) return;
      }
      handler();
    };
    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
    // refs 배열 참조는 mount 시 안정적 (개별 요소 ref.current 는 mutable).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, handler]);
}
