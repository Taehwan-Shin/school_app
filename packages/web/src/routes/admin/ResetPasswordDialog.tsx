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
import { useResetPassword } from "../../api/usersResetPassword";

export interface ResetPasswordTarget {
  email: string;
  firstName: string;
  lastName: string;
}

export interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: ResetPasswordTarget | null;
  onSuccess?: () => void;
}

export function ResetPasswordDialog({
  open,
  onOpenChange,
  user,
  onSuccess,
}: ResetPasswordDialogProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changePasswordAtNextLogin, setChangePasswordAtNextLogin] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);

  const { mutateAsync: resetPassword, isPending, error: mutationError } = useResetPassword();

  const resetForm = () => {
    setNewPassword("");
    setConfirmPassword("");
    setChangePasswordAtNextLogin(true);
    setValidationError(null);
  };

  const handleClose = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  if (!user) {
    return null;
  }

  const fullName = `${user.lastName || ""}${user.firstName || ""}`.trim();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!newPassword || newPassword.length < 8) {
      setValidationError("비밀번호는 최소 8자 이상이어야 합니다.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setValidationError("새 비밀번호와 확인 비밀번호가 일치하지 않습니다.");
      return;
    }

    try {
      await resetPassword({
        primaryEmail: user.email.trim(),
        newPassword,
        changePasswordAtNextLogin,
      });
      handleClose(false);
      onSuccess?.();
    } catch {
      // Mutation error handled below
    }
  };

  const errorMessage =
    validationError ||
    (mutationError
      ? mutationError.message.includes("admin_cannot_edit_admin") ||
        mutationError.message.includes("permission-denied")
        ? "관리자 계정 비밀번호는 재설정할 수 없습니다."
        : mutationError.message.includes("insufficient_scope")
        ? "비밀번호 재설정 권한이 부족합니다. 다시 로그인하세요."
        : `재설정 실패: ${mutationError.message}`
      : null);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle className="text-h2 font-bold text-fg-primary">
              비밀번호 재설정
            </DialogTitle>
            <DialogDescription>
              사용자의 새 비밀번호를 입력하고 옵션을 지정합니다.
            </DialogDescription>
          </DialogHeader>

          {errorMessage && (
            <div
              className="border border-state-danger p-3 text-small text-state-danger"
              data-testid="reset-password-error"
            >
              {errorMessage}
            </div>
          )}

          <div className="p-4 border border-border-subtle bg-surface space-y-1">
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

          <div className="space-y-4">
            <div>
              <label htmlFor="newPassword" className="text-small text-fg-secondary mb-1 block">
                새 비밀번호 *
              </label>
              <input
                id="newPassword"
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="8자 이상"
                data-testid="reset-password-new"
                className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="text-small text-fg-secondary mb-1 block">
                새 비밀번호 확인 *
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="비밀번호 재입력"
                data-testid="reset-password-confirm"
                className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="changePasswordAtNextLogin"
                type="checkbox"
                checked={changePasswordAtNextLogin}
                onChange={(e) => setChangePasswordAtNextLogin(e.target.checked)}
                data-testid="reset-password-change-next-login"
                className="accent-fg-primary h-4 w-4"
              />
              <label htmlFor="changePasswordAtNextLogin" className="text-small text-fg-primary cursor-pointer select-none">
                다음 로그인 시 변경 요구
              </label>
            </div>
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
              disabled={isPending}
              data-testid="reset-password-submit"
            >
              {isPending ? "재설정 중..." : "재설정"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
