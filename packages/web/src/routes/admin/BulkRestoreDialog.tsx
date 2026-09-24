import { BulkSuspendRestoreDialog } from "./BulkSuspendRestoreDialog";

// v0.123: BulkSuspend 의 대칭. `callUsersUpdate({ suspended: false })` 로 정지된
// 계정을 일괄 복구. 선택된 이메일이 이미 정상 상태여도 API 는 no-op 로 성공.
// v0.300: BulkSuspendRestoreDialog shared wrapper.
export interface BulkRestoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emails: string[];
  onDone?: () => void;
}

export function BulkRestoreDialog({
  open,
  onOpenChange,
  emails,
  onDone,
}: BulkRestoreDialogProps) {
  return (
    <BulkSuspendRestoreDialog
      open={open}
      onOpenChange={onOpenChange}
      emails={emails}
      onDone={onDone}
      suspend={false}
      testIdPrefix="bulk-restore"
      labels={{
        confirmTitle: "일괄 복구 확인",
        confirmDescription: `선택한 ${emails.length}명 계정을 복구합니다. 이미 정상 상태인 계정은 변경 없이 성공으로 처리됩니다.`,
        confirmButton: "복구 실행",
        runningTitle: "일괄 복구 진행 중",
        runningDescription: "계정을 복구하고 있습니다.",
        doneTitle: "일괄 복구 완료",
        doneDescription: "일괄 복구 작업이 완료되었습니다.",
      }}
    />
  );
}
