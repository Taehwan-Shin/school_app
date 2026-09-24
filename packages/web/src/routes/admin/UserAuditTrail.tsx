import { AuditTrail } from './AuditTrail';

// v0.243: 원본. v0.297: AuditTrail shared component wrapper.
export interface UserAuditTrailProps {
  targetEmail: string;
}

export function UserAuditTrail({ targetEmail }: UserAuditTrailProps) {
  return (
    <AuditTrail
      targetEmail={targetEmail}
      testIdPrefix="user-audit"
      tableAriaLabel="사용자 감사 이력"
      emptyMessage="이 사용자에 대한 감사 이력이 없습니다."
    />
  );
}
