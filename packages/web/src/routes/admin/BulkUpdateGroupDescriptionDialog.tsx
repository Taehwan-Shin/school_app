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
import { callGroupsUpdate } from "../../api/groupsUpdate";
import { GROUP_DESCRIPTION_MAX } from "../../lib/groupLimits";

export interface BulkUpdateGroupDescriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emails: string[];
  onDone?: () => void;
}

type Phase = "confirm" | "running" | "done";

// v0.166 → v0.173: shared constant (`lib/groupLimits`) 로 승격 · CreateGroup/EditGroup 과 통일.
const DESCRIPTION_MAX = GROUP_DESCRIPTION_MAX;

export function BulkUpdateGroupDescriptionDialog({
  open,
  onOpenChange,
  emails,
  onDone,
}: BulkUpdateGroupDescriptionDialogProps) {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>("confirm");
  const [description, setDescription] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [failures, setFailures] = useState<{ email: string; message: string }[]>([]);
  // v0.166 (== v0.124 F99 대칭): confirm 시점 emails + description snapshot.
  const [runEmails, setRunEmails] = useState<string[] | null>(null);
  const [runDescription, setRunDescription] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPhase("confirm");
      setDescription("");
      setValidationError(null);
      setProgress(0);
      setFailures([]);
      setRunEmails(null);
      setRunDescription(null);
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
    setValidationError(null);
    if (description.length > DESCRIPTION_MAX) {
      return setValidationError(
        `설명은 ${DESCRIPTION_MAX}자 이하여야 합니다. (현재 ${description.length}자)`,
      );
    }
    // F99: snapshot 을 phase 전환과 동시에 확정.
    const emailsSnapshot = [...emails];
    const descriptionSnapshot = description;
    setRunEmails(emailsSnapshot);
    setRunDescription(descriptionSnapshot);
    setPhase("running");
    const localFailures: { email: string; message: string }[] = [];
    for (let i = 0; i < emailsSnapshot.length; i++) {
      const email = emailsSnapshot[i];
      try {
        await callGroupsUpdate({ email, description: descriptionSnapshot });
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
              <DialogTitle>일괄 설명 변경 확인</DialogTitle>
              <DialogDescription>
                선택한 {emails.length}개 그룹의 설명(description) 을 동일한 값으로 변경합니다.
                기존 설명은 덮어쓰기 됩니다. 빈 값으로 두면 설명이 지워집니다.
              </DialogDescription>
            </DialogHeader>

            <div>
              <label
                htmlFor="bulk-update-group-description-input"
                className="text-small text-fg-primary block mb-1"
              >
                새 설명 (모두 공통, 최대 {DESCRIPTION_MAX}자)
              </label>
              <textarea
                id="bulk-update-group-description-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="예: 2026학년도 3학년 5반 학생 그룹"
                rows={3}
                data-testid="bulk-update-group-description-input"
                className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong resize-y"
              />
              <p className="mt-1 text-micro text-fg-muted">
                현재 {description.length} / {DESCRIPTION_MAX} 자
              </p>
            </div>

            <ul className="text-small text-fg-secondary max-h-40 overflow-y-auto space-y-1">
              {emails.slice(0, 5).map((e) => (
                <li key={e} className="font-mono">
                  {e}
                </li>
              ))}
              {emails.length > 5 && (
                <li className="text-fg-muted">... 외 {emails.length - 5}개</li>
              )}
            </ul>

            {validationError && (
              <p
                className="text-small text-state-danger"
                data-testid="bulk-update-group-description-error"
              >
                {validationError}
              </p>
            )}

            <DialogFooter>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                취소
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={description.length > DESCRIPTION_MAX}
                data-testid="bulk-update-group-description-confirm-btn"
              >
                설명 변경 실행
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === "running" && (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>일괄 설명 변경 진행 중</DialogTitle>
              <DialogDescription>그룹 설명을 변경하고 있습니다.</DialogDescription>
            </DialogHeader>
            {/* v0.258: BulkProgress 이식. */}
            <BulkProgress
              progress={progress}
              total={displayEmails.length}
              testId="bulk-update-group-description-running"
            />
          </>
        )}

        {phase === "done" && (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>일괄 설명 변경 완료</DialogTitle>
              <DialogDescription>일괄 설명 변경 작업이 완료되었습니다.</DialogDescription>
            </DialogHeader>
            <div data-testid="bulk-update-group-description-done" className="space-y-3">
              <p className="text-body text-fg-primary">
                완료:{" "}
                <strong className="text-state-success font-mono">
                  {displayEmails.length - failures.length}
                </strong>
                개 성공
                {failures.length > 0 && (
                  <>
                    {" "}
                    ·{" "}
                    <strong className="text-state-danger font-mono">{failures.length}</strong>
                    개 실패
                  </>
                )}
              </p>
              {runDescription !== null && runDescription !== "" && (
                <p
                  className="text-small text-fg-secondary"
                  data-testid="bulk-update-group-description-applied"
                >
                  적용된 설명: <span className="font-mono">「{runDescription}」</span>
                </p>
              )}
              {failures.length > 0 && (
                <ul
                  className="text-small text-state-danger space-y-1 max-h-40 overflow-y-auto"
                  data-testid="bulk-update-group-description-failures"
                >
                  {failures.map((f) => (
                    <li key={f.email}>
                      <span className="font-mono">{f.email}</span>: {f.message}
                    </li>
                  ))}
                </ul>
              )}
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
