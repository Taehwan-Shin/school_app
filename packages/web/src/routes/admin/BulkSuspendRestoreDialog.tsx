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

// v0.300: BulkSuspendDialog (v0.123) + BulkRestoreDialog (v0.123b) shared 컴포넌트 흡수.
// 두 다이얼로그의 유일한 실질 차이 (mechanically identical 3-phase flow):
//   1. `callUsersUpdate({ suspended: true/false })` 의 boolean flag → `suspend` prop
//   2. 사용자 노출 문구 (title/description/confirm/running/done · testId prefix) → `labels` + `testIdPrefix` props
// F99 snapshot · useBulkDialogPhase (v0.282) · 이식된 shared component 6종 (Preview/ConfirmCount/BulkProgress/DoneSummary/FailureList/SrOnly) 는 모두 동일 · 이 컴포넌트가 캡슐화.

export interface BulkSuspendRestoreDialogLabels {
  confirmTitle: string;
  confirmDescription: string;
  confirmButton: string;
  runningTitle: string;
  runningDescription: string;
  doneTitle: string;
  doneDescription: string;
}

export interface BulkSuspendRestoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emails: string[];
  onDone?: () => void;
  suspend: boolean;
  testIdPrefix: string;
  labels: BulkSuspendRestoreDialogLabels;
}

export function BulkSuspendRestoreDialog({
  open,
  onOpenChange,
  emails,
  onDone,
  suspend,
  testIdPrefix,
  labels,
}: BulkSuspendRestoreDialogProps) {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState(0);
  const [failures, setFailures] = useState<{ email: string; message: string }[]>([]);
  const [confirmText, setConfirmText] = useState("");
  // v0.124 (== v0.123b F99): confirm 시점 emails snapshot. 실행 중 부모 selection 이
  // 바뀌어도 승인 대상 == 처리 대상 == 완료 집계 를 일치시킴. confirm phase live prop,
  // running/done phase snapshot.
  const [runEmails, setRunEmails] = useState<string[] | null>(null);

  // v0.282: 3-phase 상태 shared hook.
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
        await callUsersUpdate({ primaryEmail: email, suspended: suspend });
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
              <DialogTitle>{labels.confirmTitle}</DialogTitle>
              <DialogDescription>{labels.confirmDescription}</DialogDescription>
            </DialogHeader>
            <PreviewList
              items={emails}
              getKey={(e) => e}
              renderItem={(e) => e}
              unit="명"
            />
            <ConfirmCountInput
              expectedCount={emails.length}
              value={confirmText}
              onChange={setConfirmText}
              idPrefix={testIdPrefix}
            />
            <DialogFooter>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                취소
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={confirmText.trim() !== String(emails.length)}
                data-testid={`${testIdPrefix}-confirm-btn`}
              >
                {labels.confirmButton}
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === "running" && (
          <>
            <SrOnlyDialogHeader
              title={labels.runningTitle}
              description={labels.runningDescription}
            />
            <BulkProgress
              progress={progress}
              total={displayEmails.length}
              testId={`${testIdPrefix}-running`}
            />
          </>
        )}

        {phase === "done" && (
          <>
            <SrOnlyDialogHeader
              title={labels.doneTitle}
              description={labels.doneDescription}
            />
            <div data-testid={`${testIdPrefix}-done`} className="space-y-3">
              <BulkDoneSummary
                successCount={displayEmails.length - failures.length}
                failureCount={failures.length}
                unit="명"
              />
              <BulkFailureList
                items={failures}
                getKey={(f) => f.email}
                renderItem={(f) => (
                  <>
                    <span className="font-mono">{f.email}</span>: {f.message}
                  </>
                )}
                testId={`${testIdPrefix}-failures`}
              />
              <DialogFooter>
                <Button onClick={() => handleOpenChange(false)}>확인</Button>
              </DialogFooter>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
