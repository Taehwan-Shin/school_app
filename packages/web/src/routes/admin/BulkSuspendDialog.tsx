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
import { callUsersUpdate } from "../../api/usersUpdate";

export interface BulkSuspendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emails: string[];
  onDone?: () => void;
}

type Phase = "confirm" | "running" | "done";

export function BulkSuspendDialog({
  open,
  onOpenChange,
  emails,
  onDone,
}: BulkSuspendDialogProps) {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>("confirm");
  const [progress, setProgress] = useState(0);
  const [failures, setFailures] = useState<{ email: string; message: string }[]>([]);
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    if (open) {
      setPhase("confirm");
      setProgress(0);
      setFailures([]);
      setConfirmText("");
    }
  }, [open]);

  const handleOpenChange = (newOpen: boolean) => {
    if (phase === "running") return;
    onOpenChange(newOpen);
  };

  const handleConfirm = async () => {
    setPhase("running");
    const localFailures: { email: string; message: string }[] = [];
    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
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
            <ul className="text-small text-fg-secondary max-h-40 overflow-y-auto space-y-1">
              {emails.slice(0, 5).map((e) => (
                <li key={e} className="font-mono">
                  {e}
                </li>
              ))}
              {emails.length > 5 && (
                <li className="text-fg-muted">... 외 {emails.length - 5}명</li>
              )}
            </ul>
            <div>
              <label className="text-small text-fg-primary">
                확인을 위해 대상 개수 (<strong>{emails.length}</strong>)를 입력하세요:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                data-testid="bulk-suspend-confirm-input"
                className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong mt-2"
              />
            </div>
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
            <DialogHeader className="sr-only">
              <DialogTitle>일괄 정지 진행 중</DialogTitle>
              <DialogDescription>계정을 정지하고 있습니다.</DialogDescription>
            </DialogHeader>
            <div className="py-8 text-center space-y-3" data-testid="bulk-suspend-running">
              <div className="text-body text-fg-primary">
                진행 중: <strong className="font-mono">{progress}</strong> /{" "}
                <strong className="font-mono">{emails.length}</strong>
              </div>
              <div className="w-full bg-canvas h-2 border border-border-subtle">
                <div
                  className="bg-fg-primary h-full transition-all"
                  style={{
                    width: `${emails.length > 0 ? (progress / emails.length) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </>
        )}

        {phase === "done" && (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>일괄 정지 완료</DialogTitle>
              <DialogDescription>일괄 정지 작업이 완료되었습니다.</DialogDescription>
            </DialogHeader>
            <div data-testid="bulk-suspend-done" className="space-y-3">
              <p className="text-body text-fg-primary">
                완료:{" "}
                <strong className="text-state-success font-mono">
                  {emails.length - failures.length}
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
                  data-testid="bulk-suspend-failures"
                >
                  {failures.map((f) => (
                    <li key={f.email}>
                      <span className="font-mono">{f.email}</span>: {f.message}
                    </li>
                  ))}
                </ul>
              )}
              <DialogFooter>
                <Button
                  onClick={() => {
                    onOpenChange(false);
                    onDone?.();
                  }}
                >
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
