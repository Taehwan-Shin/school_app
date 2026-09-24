import { BulkSuspendRestoreDialog } from "./BulkSuspendRestoreDialog";

// v0.123: 원본. v0.300: BulkSuspendRestoreDialog shared wrapper.
export interface BulkSuspendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emails: string[];
  onDone?: () => void;
}

export function BulkSuspendDialog({
  open,
  onOpenChange,
  emails,
  onDone,
}: BulkSuspendDialogProps) {
  return (
    <BulkSuspendRestoreDialog
      open={open}
      onOpenChange={onOpenChange}
      emails={emails}
      onDone={onDone}
      suspend={true}
      testIdPrefix="bulk-suspend"
      labels={{
        confirmTitle: "일괄 정지 확인",
        confirmDescription: `선택한 ${emails.length}명 계정을 정지합니다. 되돌리려면 개별 「복구」 필요.`,
        confirmButton: "정지 실행",
        runningTitle: "일괄 정지 진행 중",
        runningDescription: "계정을 정지하고 있습니다.",
        doneTitle: "일괄 정지 완료",
        doneDescription: "일괄 정지 작업이 완료되었습니다.",
      }}
    />
  );
}
