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
import { callUsersUpdateRole } from "../../api/usersUpdateRole";
import type { Role } from "@school-app/shared";

export interface BulkUpdateRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emails: string[];
  onDone?: () => void;
}

type Phase = "confirm" | "running" | "done";
// v0.163: super_admin 은 bootstrap 전용 · UI 는 admin/teacher 만.
type SelectableRole = Extract<Role, "admin" | "teacher">;

export function BulkUpdateRoleDialog({
  open,
  onOpenChange,
  emails,
  onDone,
}: BulkUpdateRoleDialogProps) {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>("confirm");
  const [targetRole, setTargetRole] = useState<SelectableRole>("admin");
  const [progress, setProgress] = useState(0);
  const [failures, setFailures] = useState<{ email: string; message: string }[]>([]);
  const [confirmText, setConfirmText] = useState("");
  // v0.163 (== v0.124 F99 대칭): confirm 시점 emails + targetRole snapshot.
  const [runEmails, setRunEmails] = useState<string[] | null>(null);
  const [runRole, setRunRole] = useState<SelectableRole | null>(null);

  useEffect(() => {
    if (open) {
      setPhase("confirm");
      setTargetRole("admin");
      setProgress(0);
      setFailures([]);
      setConfirmText("");
      setRunEmails(null);
      setRunRole(null);
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
    const emailsSnapshot = [...emails];
    const roleSnapshot = targetRole;
    setRunEmails(emailsSnapshot);
    setRunRole(roleSnapshot);
    setPhase("running");
    const localFailures: { email: string; message: string }[] = [];
    for (let i = 0; i < emailsSnapshot.length; i++) {
      const email = emailsSnapshot[i];
      try {
        await callUsersUpdateRole({ primaryEmail: email, role: roleSnapshot });
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
  const displayRole = runRole ?? targetRole;
  const roleLabel = (r: SelectableRole) => (r === "admin" ? "관리자" : "교사");

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={phase === "running" ? "[&>button]:hidden" : undefined}>
        {phase === "confirm" && (
          <>
            <DialogHeader>
              <DialogTitle>일괄 역할 변경 확인</DialogTitle>
              <DialogDescription>
                선택한 {emails.length}명의 역할을 「{roleLabel(targetRole)}」 로 변경합니다.
                되돌리려면 다시 일괄 변경 또는 개별 편집 필요.
              </DialogDescription>
            </DialogHeader>

            {/* 역할 선택 */}
            <div className="space-y-2">
              <p className="text-small text-fg-primary font-medium">변경할 역할</p>
              <div className="flex items-center gap-4" role="group" aria-label="역할 선택">
                <label className="flex items-center gap-2 text-body text-fg-primary cursor-pointer">
                  <input
                    type="radio"
                    name="bulk-update-role-target"
                    value="admin"
                    checked={targetRole === "admin"}
                    onChange={() => setTargetRole("admin")}
                    data-testid="bulk-update-role-target-admin"
                  />
                  관리자 (admin)
                </label>
                <label className="flex items-center gap-2 text-body text-fg-primary cursor-pointer">
                  <input
                    type="radio"
                    name="bulk-update-role-target"
                    value="teacher"
                    checked={targetRole === "teacher"}
                    onChange={() => setTargetRole("teacher")}
                    data-testid="bulk-update-role-target-teacher"
                  />
                  교사 (teacher)
                </label>
              </div>
            </div>

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
              {/* v0.163 (== v0.124 F100 대칭): htmlFor/id 로 label 프로그램적 연결. */}
              <label
                htmlFor="bulk-update-role-confirm-input"
                className="text-small text-fg-primary"
              >
                확인을 위해 대상 개수 (<strong>{emails.length}</strong>)를 입력하세요:
              </label>
              <input
                id="bulk-update-role-confirm-input"
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                data-testid="bulk-update-role-confirm-input"
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
                data-testid="bulk-update-role-confirm-btn"
              >
                「{roleLabel(targetRole)}」 로 변경
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === "running" && (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>일괄 역할 변경 진행 중</DialogTitle>
              <DialogDescription>계정 역할을 변경하고 있습니다.</DialogDescription>
            </DialogHeader>
            <div className="py-8 text-center space-y-3" data-testid="bulk-update-role-running">
              <div className="text-body text-fg-primary">
                진행 중 (「{roleLabel(displayRole)}」 로 변경):{" "}
                <strong className="font-mono">{progress}</strong> /{" "}
                <strong className="font-mono">{displayEmails.length}</strong>
              </div>
              <div className="w-full bg-canvas h-2 border border-border-subtle">
                <div
                  className="bg-fg-primary h-full transition-all"
                  style={{
                    width: `${
                      displayEmails.length > 0 ? (progress / displayEmails.length) * 100 : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </>
        )}

        {phase === "done" && (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>일괄 역할 변경 완료</DialogTitle>
              <DialogDescription>일괄 역할 변경 작업이 완료되었습니다.</DialogDescription>
            </DialogHeader>
            <div data-testid="bulk-update-role-done" className="space-y-3">
              <p className="text-body text-fg-primary">
                「{roleLabel(displayRole)}」 로 변경 완료:{" "}
                <strong className="text-state-success font-mono">
                  {displayEmails.length - failures.length}
                </strong>
                명 성공
                {failures.length > 0 && (
                  <>
                    {" "}
                    ·{" "}
                    <strong className="text-state-danger font-mono">{failures.length}</strong>
                    명 실패
                  </>
                )}
              </p>
              {failures.length > 0 && (
                <ul
                  className="text-small text-state-danger space-y-1 max-h-40 overflow-y-auto"
                  data-testid="bulk-update-role-failures"
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
