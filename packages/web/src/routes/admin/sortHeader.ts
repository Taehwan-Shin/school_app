// v0.138: sortable TableHead 에 키보드 접근성 부여.
//
// 기본 `<th onClick>` 은 마우스 전용이라 키보드 사용자가 정렬을 실행할 수 없다.
// AT (스크린 리더) 는 aria-sort 로 「정렬 가능한 열」 임을 인지하지만, 실제로
// Enter/Space 로 트리거할 수 없다는 mismatch.
//
// 이 helper 는 각 sortable TableHead 에 tabIndex + onKeyDown + focus ring class
// 를 반환한다. onClick 은 호출 측에서 그대로 유지 (기존 회귀 테스트 호환).

export function sortHeaderKbdProps(onActivate: () => void, extraClassName = '') {
  return {
    tabIndex: 0,
    onKeyDown: (e: React.KeyboardEvent<HTMLTableCellElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onActivate();
      }
    },
    className: `cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-strong ${extraClassName}`.trim(),
  };
}
