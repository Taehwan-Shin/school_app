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
import { ConfirmCountInput } from "../../components/ConfirmCountInput";
import { BulkProgress } from "../../components/BulkProgress";
import { PreviewList } from "../../components/PreviewList";
import { BulkDoneSummary } from "../../components/BulkDoneSummary";
import { BulkFailureList } from "../../components/BulkFailureList";
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
              idPrefix="bulk-update-role"
            />
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
            {/* v0.257: BulkProgress 이식 (label prop 으로 「{role} 로 변경」 커스텀). */}
            <BulkProgress
              progress={progress}
              total={displayEmails.length}
              testId="bulk-update-role-running"
              label={`진행 중 (「${roleLabel(displayRole)}」 로 변경):`}
            />
          </>
        )}

        {phase === "done" && (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>일괄 역할 변경 완료</DialogTitle>
              <DialogDescription>일괄 역할 변경 작업이 완료되었습니다.</DialogDescription>
            </DialogHeader>
            <div data-testid="bulk-update-role-done" className="space-y-3">
              {/* v0.265: BulkDoneSummary 이식 (label prop 커스텀). */}
              <BulkDoneSummary
                successCount={displayEmails.length - failures.length}
                failureCount={failures.length}
                unit="명"
                label={`「${roleLabel(displayRole)}」 로 변경 완료:`}
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
                testId="bulk-update-role-failures"
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
