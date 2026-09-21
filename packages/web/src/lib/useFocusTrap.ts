import { useEffect, useRef, type RefObject } from 'react';

// v0.206: 컨테이너 안에 focus 를 가둠. popover/menu 접근성 개선.
// - enabled=true 진입 시 이전 focused element 저장 후 컨테이너 첫 focusable 로 focus.
// - Tab / Shift+Tab 이 컨테이너 밖으로 나가려 할 때 wrap around.
// - enabled=false (unmount 또는 disable) 시 이전 focused element 로 복원.
// - focusable selector: button/input/select/textarea/a[href]/[tabindex] (`tabindex="-1"` 제외 · disabled 제외).
export function useFocusTrap(
  containerRef: RefObject<HTMLElement>,
  enabled: boolean,
) {
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;

    // 저장 후 첫 focusable 로 이동.
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const getFocusables = (): HTMLElement[] =>
      Array.from(
        container.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(
        (el) => !(el as HTMLButtonElement).disabled && el.tabIndex !== -1,
      );

    const first = getFocusables()[0];
    first?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusables = getFocusables();
      if (focusables.length === 0) return;
      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === firstEl || !container.contains(active)) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (active === lastEl || !container.contains(active)) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Restore focus to whatever had it before (usually the trigger button).
      previouslyFocused.current?.focus?.();
    };
    // containerRef 는 mount 안정 · enabled 변경만 재실행.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
