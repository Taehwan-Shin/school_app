import type { OrgunitEntry } from '../api/orgunitsList';

// v0.327: 「기존 조직 단위에서 선택」 드롭다운 공통 (v0.320 EditUserDialog 에서 승격).
// 선택하면 onChange(path) — 직접 입력칸은 각 화면이 그대로 유지한다 (새 경로 입력 · 목록 로드 실패 대비).
// value 가 목록에 없으면 placeholder 를 보여준다.
export interface OrgUnitSelectProps {
  value: string;
  onChange: (path: string) => void;
  orgUnits: OrgunitEntry[];
  disabled?: boolean;
  testId: string;
  className?: string;
}

export function OrgUnitSelect({ value, onChange, orgUnits, disabled, testId, className }: OrgUnitSelectProps) {
  const sorted = [...orgUnits].sort((a, b) => a.orgUnitPath.localeCompare(b.orgUnitPath, 'ko'));
  return (
    <select
      aria-label="기존 OU 목록에서 선택"
      value={sorted.some((ou) => ou.orgUnitPath === value) ? value : ''}
      onChange={(e) => {
        if (e.target.value) onChange(e.target.value);
      }}
      disabled={disabled || sorted.length === 0}
      data-testid={testId}
      className={`w-full mb-2 border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong disabled:opacity-60 disabled:cursor-not-allowed ${className ?? ''}`}
    >
      <option value="">
        {sorted.length === 0 ? '기존 조직 단위 없음 (직접 입력)' : '기존 조직 단위에서 선택...'}
      </option>
      {sorted.map((ou) => (
        <option key={ou.orgUnitPath} value={ou.orgUnitPath}>
          {ou.name ? `${ou.orgUnitPath} — ${ou.name}` : ou.orgUnitPath}
        </option>
      ))}
    </select>
  );
}
