import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { ConfirmCountInput } from "../../components/ConfirmCountInput";
import { BulkProgress } from "../../components/BulkProgress";
import { PreviewList } from "../../components/PreviewList";
import { BulkDoneSummary } from "../../components/BulkDoneSummary";
import { BulkFailureList } from "../../components/BulkFailureList";
import { SrOnlyDialogHeader } from "../../components/SrOnlyDialogHeader";
import { useBulkDialogPhase } from "../../lib/useBulkDialogPhase";
import { callUsersUpdate } from "../../api/usersUpdate";

export interface BulkRestoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emails: string[];
  onDone?: () => void;
}

// v0.123: BulkSuspend 의 대칭. `callUsersUpdate({ suspended: false })` 로 정지된
// 계정을 일괄 복구. 선택된 이메일이 이미 정상 상태여도 API 는 no-op 로 성공.
export function BulkRestoreDialog({
  open,
  onOpenChange,
  emails,
  onDone,
}: BulkRestoreDialogProps) {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState(0);
  const [failures, setFailures] = useState<{ email: string; message: string }[]>([]);
  const [confirmText, setConfirmText] = useState("");
  // v0.123b F99: confirm 시점의 emails snapshot. 실행 중 부모의 selection 이
  // 바뀌어도 승인 대상 == 처리 대상 == 완료 집계 를 일치시켜 accountability
  // 유지. running/done phase 는 아래 snapshot 을 우선 사용, confirm phase 는
  // 아직 실행 전이라 live prop.
  const [runEmails, setRunEmails] = useState<string[] | null>(null);

  // v0.282: 3-phase 상태 shared hook 이식.
  const { phase, setPhase, handleOpenChange } = useBulkDialogPhase({
    open,
    onOpenChange,
    onDone,
    onOpen: () => {
      setProgress(0);
      setFailures([]);
      setConfirmText("");
      setRunEmails(null);
    },
  });

  const handleConfirm = async () => {
    // F99: snapshot 을 phase 전환과 동시에 확정.
    const snapshot = [...emails];
    setRunEmails(snapshot);
    setPhase("running");
    const localFailures: { email: string; message: string }[] = [];
    for (let i = 0; i < snapshot.length; i++) {
      const email = snapshot[i];
      try {
        await callUsersUpdate({ primaryEmail: email, suspended: false });
      } catch (e) {
        localFailures.push({ email, message: (e as Error).message });
      }
      setProgress(i + 1);
    }
    setFailures(localFailures);
    setPhase("done");
    queryClient.invalidateQueries({ queryKey: ["users", "list"] });
  };

  // running/done phase 는 snapshot, confirm phase 는 live prop.
  const displayEmails = runEmails ?? emails;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={phase === "running" ? "[&>button]:hidden" : undefined}>
        {phase === "confirm" && (
          <>
            <DialogHeader>
              <DialogTitle>일괄 복구 확인</DialogTitle>
              <DialogDescription>
                선택한 {emails.length}명 계정을 복구합니다. 이미 정상 상태인 계정은
                변경 없이 성공으로 처리됩니다.
              </DialogDescription>
            </DialogHeader>
            {/* v0.262: PreviewList 이식. */}
            <PreviewList
              items={emails}
              getKey={(e) => e}
              renderItem={(e) => e}
              unit="명"
            />
            {/* v0.254: ConfirmCountInput 이식. */}
            <ConfirmCountInput
              expectedCount={emails.length}
              value={confirmText}
              onChange={setConfirmText}
              idPrefix="bulk-restore"
            />
            <DialogFooter>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                취소
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={confirmText.trim() !== String(emails.length)}
                data-testid="bulk-restore-confirm-btn"
              >
                복구 실행
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === "running" && (
          <>
            {/* v0.276: SrOnlyDialogHeader 이식. */}
            <SrOnlyDialogHeader title="일괄 복구 진행 중" description="계정을 복구하고 있습니다." />
            {/* v0.257: BulkProgress 이식. */}
            <BulkProgress
              progress={progress}
              total={displayEmails.length}
              testId="bulk-restore-running"
            />
          </>
        )}

        {phase === "done" && (
          <>
            {/* v0.276: SrOnlyDialogHeader 이식. */}
            <SrOnlyDialogHeader title="일괄 복구 완료" description="일괄 복구 작업이 완료되었습니다." />
            <div data-testid="bulk-restore-done" className="space-y-3">
              {/* v0.265: BulkDoneSummary 이식. */}
              <BulkDoneSummary
                successCount={displayEmails.length - failures.length}
                failureCount={failures.length}
                unit="명"
              />
              {/* v0.271: BulkFailureList 이식. */}
              <BulkFailureList
                items={failures}
                getKey={(f) => f.email}
                renderItem={(f) => (
                  <>
                    <span className="font-mono">{f.email}</span>: {f.message}
                  </>
                )}
                testId="bulk-restore-failures"
              />
              <DialogFooter>
                <Button onClick={() => handleOpenChange(false)}>
                  확인
                </Button>
              </DialogFooter>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
