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

export interface BulkMoveOuDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emails: string[];
  onDone?: () => void;
}

type Phase = "confirm" | "running" | "done";

export function BulkMoveOuDialog({
  open,
  onOpenChange,
  emails,
  onDone,
}: BulkMoveOuDialogProps) {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>("confirm");
  const [progress, setProgress] = useState(0);
  const [failures, setFailures] = useState<{ email: string; message: string }[]>([]);
  const [targetOu, setTargetOu] = useState("");

  useEffect(() => {
    if (open) {
      setPhase("confirm");
      setProgress(0);
      setFailures([]);
      setTargetOu("");
    }
  }, [open]);

  const handleOpenChange = (newOpen: boolean) => {
    if (phase === "running") return;
    onOpenChange(newOpen);
  };

  const handleConfirm = async () => {
    const trimmed = targetOu.trim();
    if (!trimmed) return;
    setPhase("running");
    const localFailures: { email: string; message: string }[] = [];
    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      try {
        await callUsersUpdate({ primaryEmail: email, orgUnitPath: trimmed });
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
              <DialogTitle>일괄 조직 이동 확인</DialogTitle>
              <DialogDescription>
                선택한 {emails.length}명 계정의 조직 단위 (orgUnitPath) 를 아래 값으로 이동합니다.
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
                대상 조직 단위 경로:
              </label>
              <input
                type="text"
                value={targetOu}
                onChange={(e) => setTargetOu(e.target.value)}
                placeholder="/graduated/2026"
                data-testid="bulk-move-ou-input"
                className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary placeholder:text-fg-muted focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong mt-2"
              />
              <p className="text-micro text-fg-muted mt-1">예: /students/12, /graduated/2026, / (루트)</p>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                취소
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={targetOu.trim() === ""}
                data-testid="bulk-move-ou-confirm-btn"
              >
                이동 실행
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === "running" && (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>일괄 조직 이동 진행 중</DialogTitle>
              <DialogDescription>계정 조직 단위를 이동하고 있습니다.</DialogDescription>
            </DialogHeader>
            <div className="py-8 text-center space-y-3" data-testid="bulk-move-ou-running">
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
              <DialogTitle>일괄 조직 이동 완료</DialogTitle>
              <DialogDescription>일괄 조직 이동 작업이 완료되었습니다.</DialogDescription>
            </DialogHeader>
            <div data-testid="bulk-move-ou-done" className="space-y-3">
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
                  data-testid="bulk-move-ou-failures"
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
