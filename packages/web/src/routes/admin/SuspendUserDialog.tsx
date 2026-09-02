import { useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { useUpdateUser } from "../../api/usersUpdate";
import { cn } from "../../lib/utils";

export interface SuspendUserTarget {
  email: string;
  firstName: string;
  lastName: string;
  isSuspended: boolean;
}

export interface SuspendUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: SuspendUserTarget | null;
}

export function SuspendUserDialog({ open, onOpenChange, user }: SuspendUserDialogProps) {
  const [confirmEmail, setConfirmEmail] = useState("");
  const { mutateAsync: updateUser, isPending, error: mutationError } = useUpdateUser();

  const handleClose = (newOpen: boolean) => {
    if (!newOpen) {
      setConfirmEmail("");
    }
    onOpenChange(newOpen);
  };

  if (!user) {
    return null;
  }

  const isSuspended = user.isSuspended;
  const isConfirmed = confirmEmail.trim() === user.email.trim();
  const fullName = `${user.lastName || ""}${user.firstName || ""}`.trim();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isConfirmed) return;

    try {
      await updateUser({
        primaryEmail: user.email.trim(),
        suspended: !user.isSuspended,
      });
      handleClose(false);
    } catch {
      // Mutation error handled below
    }
  };

  const errorMessage = mutationError
    ? mutationError.message.includes("admin_cannot_edit_admin") ||
      mutationError.message.includes("permission-denied")
      ? "관리자 계정은 정지·복구할 수 없습니다."
      : isSuspended
      ? `계정 복구 실패: ${mutationError.message}`
      : `계정 정지 실패: ${mutationError.message}`
    : null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle
              className={cn(
                "text-h2 font-bold",
                isSuspended ? "text-fg-primary" : "text-state-warning"
              )}
            >
              {isSuspended ? "계정 복구 확인" : "계정 정지 확인"}
            </DialogTitle>
            <DialogDescription>
              {isSuspended
                ? "계정을 복구하면 사용자가 다시 로그인하고 서비스를 정상적으로 이용할 수 있습니다."
                : "계정을 정지하면 사용자가 로그인할 수 없으며 서비스 접근이 차단됩니다."}
            </DialogDescription>
          </DialogHeader>

          {errorMessage && (
            <div
              className="border border-state-danger p-3 text-small text-state-danger"
              data-testid="suspend-user-error"
            >
              {errorMessage}
            </div>
          )}

          <div className="p-4 border border-border-subtle bg-surface space-y-2">
            <div>
              <span className="text-small text-fg-secondary">대상 계정: </span>
              <span className="text-body font-mono text-fg-primary">{user.email}</span>
            </div>
            {fullName && (
              <div>
                <span className="text-small text-fg-secondary">사용자 이름: </span>
                <span className="text-body text-fg-primary">{fullName}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="confirmEmail" className="text-small text-fg-secondary mb-1 block">
              {isSuspended ? "복구하려면" : "정지하려면"} 대상 이메일(<strong>{user.email}</strong>)을 다시 입력하세요:
            </label>
            <input
              id="confirmEmail"
              type="text"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder={user.email}
              className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleClose(false)}
              disabled={isPending}
            >
              취소
            </Button>
            <Button
              type="submit"
              variant="default"
              disabled={!isConfirmed || isPending}
              data-testid="suspend-user-submit"
            >
              {isPending
                ? isSuspended
                  ? "복구 중..."
                  : "정지 중..."
                : isSuspended
                ? "복구"
                : "정지"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
