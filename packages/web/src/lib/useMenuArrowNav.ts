import { useEffect, type RefObject } from 'react';

// v0.218: WAI-ARIA menu 방향키 탐색. 4 테이블 컬럼 메뉴 (Accounts/Groups/Classroom/AuditLog) 공용.
// - `ArrowDown`: 다음 focusable menu 항목으로 이동. 마지막에서 첫 번째로 wrap.
// - `ArrowUp`: 이전 focusable menu 항목으로. 첫 번째에서 마지막으로 wrap.
// - `Home` / `End`: 첫/마지막 항목.
// - 기본 focus 진입/Tab wrap 은 v0.206 `useFocusTrap` 이 담당. 이 hook 은 방향키만.
// - focusable selector: `useFocusTrap` 과 동일. disabled/tabindex=-1 제외.
export function useMenuArrowNav(
  containerRef: RefObject<HTMLElement>,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;

    const getFocusables = (): HTMLElement[] =>
      Array.from(
        container.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(
        (el) => !(el as HTMLButtonElement).disabled && el.tabIndex !== -1,
      );

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key !== 'ArrowDown' &&
        e.key !== 'ArrowUp' &&
        e.key !== 'Home' &&
        e.key !== 'End'
      ) {
        return;
      }
      // v0.218 R1 F-A: container 외부에서 발생한 방향키는 가로채지 않음.
      const active = document.activeElement as HTMLElement | null;
      if (!active || !container.contains(active)) return;
      const focusables = getFocusables();
      if (focusables.length === 0) return;
      const currentIdx = focusables.indexOf(active);
      let nextIdx: number;
      if (e.key === 'ArrowDown') {
        nextIdx = currentIdx < 0 ? 0 : (currentIdx + 1) % focusables.length;
      } else if (e.key === 'ArrowUp') {
        nextIdx =
          currentIdx <= 0 ? focusables.length - 1 : currentIdx - 1;
      } else if (e.key === 'Home') {
        nextIdx = 0;
      } else {
        nextIdx = focusables.length - 1;
      }
      e.preventDefault();
      focusables[nextIdx]?.focus();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
    // containerRef 는 mount 안정 · enabled 변경만 재실행.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
