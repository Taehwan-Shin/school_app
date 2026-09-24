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
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState(0);
  const [failures, setFailures] = useState<{ email: string; message: string }[]>([]);
  const [confirmText, setConfirmText] = useState("");
  // v0.124 (== v0.123b F99 대칭): confirm 시점의 emails snapshot. 실행 중 부모
  // selection 이 바뀌어도 승인 대상 == 처리 대상 == 완료 집계 를 일치시켜
  // accountability 유지. confirm phase 는 live prop, running/done 은 snapshot.
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
        await callUsersUpdate({ primaryEmail: email, suspended: true });
      } catch (e) {
        localFailures.push({ email, message: (e as Error).message });
      }
      setProgress(i + 1);
    }
    setFailures(localFailures);
    setPhase("done");
    queryClient.invalidateQueries({ queryKey: ["users", "list"] });
  };

  const displayEmails = runEmails ?? emails;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={phase === "running" ? "[&>button]:hidden" : undefined}>
        {phase === "confirm" && (
          <>
            <DialogHeader>
              <DialogTitle>일괄 정지 확인</DialogTitle>
              <DialogDescription>
                선택한 {emails.length}명 계정을 정지합니다. 되돌리려면 개별 「복구」 필요.
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
              idPrefix="bulk-suspend"
            />
            <DialogFooter>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                취소
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={confirmText.trim() !== String(emails.length)}
                data-testid="bulk-suspend-confirm-btn"
              >
                정지 실행
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === "running" && (
          <>
            {/* v0.276: SrOnlyDialogHeader 이식. */}
            <SrOnlyDialogHeader title="일괄 정지 진행 중" description="계정을 정지하고 있습니다." />
            {/* v0.257: BulkProgress 이식. */}
            <BulkProgress
              progress={progress}
              total={displayEmails.length}
              testId="bulk-suspend-running"
            />
          </>
        )}

        {phase === "done" && (
          <>
            {/* v0.276: SrOnlyDialogHeader 이식. */}
            <SrOnlyDialogHeader title="일괄 정지 완료" description="일괄 정지 작업이 완료되었습니다." />
            <div data-testid="bulk-suspend-done" className="space-y-3">
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
                testId="bulk-suspend-failures"
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
