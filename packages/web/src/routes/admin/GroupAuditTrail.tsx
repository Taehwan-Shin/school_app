import { AuditTrail } from './AuditTrail';

// v0.244: 원본. v0.297: AuditTrail shared component wrapper.
export interface GroupAuditTrailProps {
  groupEmail: string;
}

export function GroupAuditTrail({ groupEmail }: GroupAuditTrailProps) {
  return (
    <AuditTrail
      targetEmail={groupEmail}
      testIdPrefix="group-audit"
      tableAriaLabel="그룹 감사 이력"
      emptyMessage="이 그룹에 대한 감사 이력이 없습니다."
    />
  );
}
