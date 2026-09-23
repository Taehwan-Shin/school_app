import { useState, useEffect } from "react";
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
import { BulkProgress } from "../../components/BulkProgress";
import { PreviewList } from "../../components/PreviewList";
import { BulkDoneSummary } from "../../components/BulkDoneSummary";
import { BulkFailureList } from "../../components/BulkFailureList";
import { callUsersDelete } from "../../api/usersDelete";

export interface BulkDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emails: string[];
  onDone?: () => void;
}

type Phase = "confirm" | "running" | "done";

export function BulkDeleteDialog({
  open,
  onOpenChange,
  emails,
  onDone,
}: BulkDeleteDialogProps) {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>("confirm");
  const [progress, setProgress] = useState(0);
  const [failures, setFailures] = useState<{ email: string; message: string }[]>([]);
  const [confirmText, setConfirmText] = useState("");
  // v0.128 (== v0.124 F99 대칭): confirm 시점의 emails snapshot 확정 —
  // 실행 중 부모 selection 이 바뀌어도 승인 대상 == 처리 대상 == 완료 집계.
  const [runEmails, setRunEmails] = useState<string[] | null>(null);

  const requiredPhrase = `삭제 ${emails.length}`;

  useEffect(() => {
    if (open) {
      setPhase("confirm");
      setProgress(0);
      setFailures([]);
      setConfirmText("");
      setRunEmails(null);
    }
  }, [open]);

  const handleOpenChange = (newOpen: boolean) => {
    if (phase === "running") return;
    if (!newOpen && phase === "done") {
      onDone?.();
    }
    onOpenChange(newOpen);
  };

  const handleConfirm = async () => {
    // F99: snapshot 을 phase 전환과 동시에 확정.
    const snapshot = [...emails];
    setRunEmails(snapshot);
    setPhase("running");
    const localFailures: { email: string; message: string }[] = [];
    for (let i = 0; i < snapshot.length; i++) {
      const email = snapshot[i];
      try {
        await callUsersDelete({ primaryEmail: email });
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
              <DialogTitle className="text-state-danger">일괄 삭제 확인</DialogTitle>
              <DialogDescription>
                선택한 {emails.length}명 계정을 Google Workspace 에서 영구 삭제합니다. 이 작업은 되돌릴 수 없습니다.
              </DialogDescription>
            </DialogHeader>
            {/* v0.262: PreviewList 이식. */}
            <PreviewList
              items={emails}
              getKey={(e) => e}
              renderItem={(e) => e}
              unit="명"
            />
            <div>
              {/* v0.128 (== v0.124 F100 대칭): htmlFor/id 로 프로그램적 연결
                  (UI_SYSTEM label semantics). getByLabelText 회귀 가능. */}
              <label
                htmlFor="bulk-delete-confirm-input"
                className="text-small text-fg-primary"
              >
                실행하려면 아래 문구를 정확히 입력하세요: <strong className="font-mono">{requiredPhrase}</strong>
              </label>
              <input
                id="bulk-delete-confirm-input"
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                data-testid="bulk-delete-confirm-input"
                className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong mt-2"
              />
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                취소
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={confirmText.trim() !== requiredPhrase}
                variant="destructive"
                data-testid="bulk-delete-confirm-btn"
              >
                삭제 실행
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === "running" && (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>일괄 삭제 진행 중</DialogTitle>
              <DialogDescription>계정을 삭제하고 있습니다.</DialogDescription>
            </DialogHeader>
            {/* v0.258: BulkProgress 이식. */}
            <BulkProgress
              progress={progress}
              total={displayEmails.length}
              testId="bulk-delete-running"
            />
          </>
        )}

        {phase === "done" && (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>일괄 삭제 완료</DialogTitle>
              <DialogDescription>일괄 삭제 작업이 완료되었습니다.</DialogDescription>
            </DialogHeader>
            <div data-testid="bulk-delete-done" className="space-y-3">
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
                testId="bulk-delete-failures"
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
