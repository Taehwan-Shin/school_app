import { useCallback, useRef, useState, type RefObject } from 'react';
import { useClickOutside } from './useClickOutside';
import { useEscapeKey } from './useEscapeKey';
import { useFocusTrap } from './useFocusTrap';
import { useMenuArrowNav } from './useMenuArrowNav';

// v0.289: admin 테이블 컬럼 표시 popover menu 상태 · 4 hook 배선 shared.
// - 3 admin 테이블 (Accounts/Groups/Classroom) 동일한 8줄 반복 (state + 2 ref + close callback + 4 hook 호출) 흡수.
// - `close` 는 useCallback 안정 참조 (기존 각 테이블 useCallback 대칭).
// - `toggle` 은 함수 setter 형태 유지 (`prev => !prev`).
// - 배선된 hook 4개:
//   · useClickOutside([buttonRef, menuRef], close, isOpen)
//   · useEscapeKey(close, isOpen)
//   · useFocusTrap(menuRef, isOpen)
//   · useMenuArrowNav(menuRef, isOpen)
// - AuditLogTable 은 useColumnMenu 미사용 (컬럼 메뉴 구조가 다름 · 별도 오더 대상).

export interface UseColumnMenuReturn {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  buttonRef: RefObject<HTMLButtonElement>;
  menuRef: RefObject<HTMLDivElement>;
}

export function useColumnMenu(): UseColumnMenuReturn {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setIsOpen(false), []);
  const open = useCallback(() => setIsOpen(true), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  useClickOutside([buttonRef, menuRef], close, isOpen);
  useEscapeKey(close, isOpen);
  useFocusTrap(menuRef, isOpen);
  useMenuArrowNav(menuRef, isOpen);

  return { isOpen, open, close, toggle, buttonRef, menuRef };
}
