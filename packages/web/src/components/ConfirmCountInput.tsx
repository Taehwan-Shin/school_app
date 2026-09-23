// v0.253: 파괴적 bulk 다이얼로그 「대상 개수 정확 입력」 확인 관문 shared component.
// - 라벨 「확인을 위해 대상 개수 (<strong>N</strong>)를 입력하세요:」 + text input.
// - htmlFor/id 로 label 프로그램적 연결 (v0.124 F100 대칭).
// - id/testId = `${idPrefix}-confirm-input` (기존 7 dialogs 관례).
// - 값 검증 (String(expectedCount) === value) 은 소비자 몫 (기존 대칭 유지).
// - 기존 사이트별 소비자 pattern:
//     BulkDelete/Update/Suspend/Restore/DeleteGroup/UpdateRole/TransferOwner/ArchiveClassroom
//   → v0.253+ 로 순차 이식.

import type { ChangeEvent } from 'react';

export interface ConfirmCountInputProps {
  expectedCount: number;
  value: string;
  onChange: (next: string) => void;
  idPrefix: string;
  disabled?: boolean;
}

const INPUT_CLASS =
  'w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong mt-2';

export function ConfirmCountInput({
  expectedCount,
  value,
  onChange,
  idPrefix,
  disabled,
}: ConfirmCountInputProps) {
  const id = `${idPrefix}-confirm-input`;
  return (
    <div>
      <label htmlFor={id} className="text-small text-fg-primary">
        확인을 위해 대상 개수 (<strong>{expectedCount}</strong>)를 입력하세요:
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        data-testid={id}
        disabled={disabled}
        className={INPUT_CLASS}
      />
    </div>
  );
}
