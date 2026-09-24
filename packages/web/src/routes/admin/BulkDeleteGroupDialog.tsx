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
import { callGroupsDelete } from "../../api/groupsDelete";

export interface BulkDeleteGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emails: string[];
  onDone?: () => void;
}

export function BulkDeleteGroupDialog({
  open,
  onOpenChange,
  emails,
  onDone,
}: BulkDeleteGroupDialogProps) {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState(0);
  const [failures, setFailures] = useState<{ email: string; message: string }[]>([]);
  const [confirmText, setConfirmText] = useState("");
  // v0.165 (== v0.124 F99 대칭): confirm 시점 emails snapshot.
  const [runEmails, setRunEmails] = useState<string[] | null>(null);

  // v0.281: 3-phase 상태 + handleOpenChange shared hook 이식.
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
    const snapshot = [...emails];
    setRunEmails(snapshot);
    setPhase("running");
    const localFailures: { email: string; message: string }[] = [];
    for (let i = 0; i < snapshot.length; i++) {
      const email = snapshot[i];
      try {
        await callGroupsDelete({ email });
      } catch (e) {
        localFailures.push({ email, message: (e as Error).message });
      }
      setProgress(i + 1);
    }
    setFailures(localFailures);
    setPhase("done");
    queryClient.invalidateQueries({ queryKey: ["groups", "list"] });
  };

  const displayEmails = runEmails ?? emails;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={phase === "running" ? "[&>button]:hidden" : undefined}>
        {phase === "confirm" && (
          <>
            <DialogHeader>
              <DialogTitle>일괄 그룹 삭제 확인</DialogTitle>
              <DialogDescription>
                선택한 {emails.length}개 그룹을 삭제합니다.{" "}
                <strong className="text-state-danger">이 작업은 되돌릴 수 없습니다.</strong>{" "}
                삭제된 그룹의 멤버 매핑도 함께 사라집니다.
              </DialogDescription>
            </DialogHeader>
            {/* v0.261: PreviewList 이식. */}
            <PreviewList
              items={emails}
              getKey={(e) => e}
              renderItem={(e) => e}
              unit="개"
            />
            {/* v0.253: 「대상 개수 정확 입력」 관문 → 신규 ConfirmCountInput shared. */}
            <ConfirmCountInput
              expectedCount={emails.length}
              value={confirmText}
              onChange={setConfirmText}
              idPrefix="bulk-delete-group"
            />
            <DialogFooter>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                취소
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={confirmText.trim() !== String(emails.length)}
                data-testid="bulk-delete-group-confirm-btn"
                className="text-state-danger"
              >
                삭제 실행
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === "running" && (
          <>
            {/* v0.275: SrOnlyDialogHeader 이식. */}
            <SrOnlyDialogHeader title="일괄 그룹 삭제 진행 중" description="그룹을 삭제하고 있습니다." />
            {/* v0.256: BulkProgress 이식. */}
            <BulkProgress
              progress={progress}
              total={displayEmails.length}
              testId="bulk-delete-group-running"
            />
          </>
        )}

        {phase === "done" && (
          <>
            {/* v0.275: SrOnlyDialogHeader 이식. */}
            <SrOnlyDialogHeader title="일괄 그룹 삭제 완료" description="일괄 그룹 삭제 작업이 완료되었습니다." />
            <div data-testid="bulk-delete-group-done" className="space-y-3">
              {/* v0.264: BulkDoneSummary 이식. */}
              <BulkDoneSummary
                successCount={displayEmails.length - failures.length}
                failureCount={failures.length}
                unit="개"
              />
              {/* v0.270: BulkFailureList 이식. */}
              <BulkFailureList
                items={failures}
                getKey={(f) => f.email}
                renderItem={(f) => (
                  <>
                    <span className="font-mono">{f.email}</span>: {f.message}
                  </>
                )}
                testId="bulk-delete-group-failures"
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
