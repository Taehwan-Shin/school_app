import { useState, useEffect, useContext } from "react";
import { QueryClientContext } from "@tanstack/react-query";
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
import { callGroupsMembersDelete } from "../../api/groupsMembersDelete";

export interface BulkRemoveMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupEmail: string;
  memberEmails: string[];
  onDone?: () => void;
}

type Phase = "confirm" | "running" | "done";

export function BulkRemoveMembersDialog({
  open,
  onOpenChange,
  groupEmail,
  memberEmails,
  onDone,
}: BulkRemoveMembersDialogProps) {
  const queryClient = useContext(QueryClientContext);
  const [phase, setPhase] = useState<Phase>("confirm");
  const [progress, setProgress] = useState(0);
  const [failures, setFailures] = useState<{ email: string; message: string }[]>([]);
  const [confirmText, setConfirmText] = useState("");
  // v0.131 (== v0.124 F99 대칭): confirm 시점의 memberEmails snapshot 확정.
  const [runMemberEmails, setRunMemberEmails] = useState<string[] | null>(null);

  const requiredPhrase = `제거 ${memberEmails.length}`;

  useEffect(() => {
    if (open) {
      setPhase("confirm");
      setProgress(0);
      setFailures([]);
      setConfirmText("");
      setRunMemberEmails(null);
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
    const snapshot = [...memberEmails];
    setRunMemberEmails(snapshot);
    setPhase("running");
    const localFailures: { email: string; message: string }[] = [];
    for (let i = 0; i < snapshot.length; i++) {
      const memberEmail = snapshot[i];
      try {
        await callGroupsMembersDelete({ groupEmail, memberEmail });
      } catch (e) {
        localFailures.push({ email: memberEmail, message: (e as Error).message });
      }
      setProgress(i + 1);
    }
    setFailures(localFailures);
    setPhase("done");
    queryClient?.invalidateQueries({ queryKey: ["groups", "members", groupEmail] });
    queryClient?.invalidateQueries({ queryKey: [`groups/members/${groupEmail}`] });
  };

  const displayEmails = runMemberEmails ?? memberEmails;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={phase === "running" ? "[&>button]:hidden" : undefined}>
        {phase === "confirm" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-state-danger">일괄 멤버 제거 확인</DialogTitle>
              <DialogDescription>
                <span className="font-mono">{groupEmail}</span> 에서 {memberEmails.length}명 멤버를 제거합니다. 그룹 자체는 유지됩니다.
              </DialogDescription>
            </DialogHeader>
            {/* v0.263: PreviewList 이식. */}
            <PreviewList
              items={memberEmails}
              getKey={(e) => e}
              renderItem={(e) => e}
              unit="명"
            />
            <div>
              {/* v0.131 (== v0.124 F100 대칭): htmlFor/id 로 프로그램적 연결. */}
              <label
                htmlFor="bulk-remove-confirm-input"
                className="text-small text-fg-primary"
              >
                실행하려면 아래 문구를 정확히 입력하세요: <strong className="font-mono">{requiredPhrase}</strong>
              </label>
              <input
                id="bulk-remove-confirm-input"
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                data-testid="bulk-remove-confirm-input"
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
                data-testid="bulk-remove-confirm-btn"
              >
                제거 실행
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === "running" && (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>일괄 멤버 제거 진행 중</DialogTitle>
              <DialogDescription>멤버를 제거하고 있습니다.</DialogDescription>
            </DialogHeader>
            {/* v0.258: BulkProgress 이식. */}
            <BulkProgress
              progress={progress}
              total={displayEmails.length}
              testId="bulk-remove-running"
            />
          </>
        )}

        {phase === "done" && (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>일괄 멤버 제거 완료</DialogTitle>
              <DialogDescription>일괄 멤버 제거 작업이 완료되었습니다.</DialogDescription>
            </DialogHeader>
            <div data-testid="bulk-remove-done" className="space-y-3">
              <p className="text-body text-fg-primary">
                완료:{" "}
                <strong className="text-state-success font-mono">
                  {displayEmails.length - failures.length}
                </strong>
                명 성공
                {failures.length > 0 && (
                  <>
                    {" "}
                    ·{" "}
                    <strong className="text-state-danger font-mono">
                      {failures.length}
                    </strong>
                    명 실패
                  </>
                )}
              </p>
              {failures.length > 0 && (
                <ul
                  className="text-small text-state-danger space-y-1 max-h-40 overflow-y-auto"
                  data-testid="bulk-remove-failures"
                >
                  {failures.map((f) => (
                    <li key={f.email}>
                      <span className="font-mono">{f.email}</span>: {f.message}
                    </li>
                  ))}
                </ul>
              )}
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
