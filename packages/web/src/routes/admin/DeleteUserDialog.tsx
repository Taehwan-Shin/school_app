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
import { useDeleteUser } from "../../api/usersDelete";

export interface DeleteUserTarget {
  email: string;
  firstName?: string;
  lastName?: string;
}

export interface DeleteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: DeleteUserTarget | null;
}

export function DeleteUserDialog({ open, onOpenChange, user }: DeleteUserDialogProps) {
  const [confirmEmail, setConfirmEmail] = useState("");
  const { mutateAsync: deleteUser, isPending, error: mutationError } = useDeleteUser();

  const handleClose = (newOpen: boolean) => {
    if (!newOpen) {
      setConfirmEmail("");
    }
    onOpenChange(newOpen);
  };

  const isConfirmed = user ? confirmEmail.trim() === user.email.trim() : false;
  const fullName = user ? `${user.lastName || ""}${user.firstName || ""}`.trim() : "";

  const handleDelete = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !isConfirmed) return;

    try {
      await deleteUser({ primaryEmail: user.email.trim() });
      handleClose(false);
    } catch {
      // Mutation error handled below
    }
  };

  const errorMessage = mutationError
    ? mutationError.message.includes("cannot_delete_self")
      ? "본인 계정은 삭제할 수 없습니다."
      : mutationError.message.includes("admin_cannot_delete_admin") ||
        mutationError.message.includes("permission-denied")
      ? "관리자 계정을 삭제할 수 있는 권한이 없습니다 (super_admin 전용)."
      : `계정 삭제 실패: ${mutationError.message}`
    : null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <form onSubmit={handleDelete} className="space-y-6">
          <DialogHeader>
            <DialogTitle className="text-h2 font-bold text-fg-primary">계정 삭제 확인</DialogTitle>
            <DialogDescription>
              이 작업은 되돌릴 수 없습니다. Google Workspace 에서 계정이 영구적으로 삭제됩니다.
            </DialogDescription>
          </DialogHeader>

          {errorMessage && (
            <div
              className="border border-state-danger p-3 text-small text-state-danger"
              data-testid="delete-user-error"
            >
              {errorMessage}
            </div>
          )}

          <div className="p-4 border border-border-subtle bg-surface space-y-2">
            <div>
              <span className="text-small text-fg-secondary">대상 계정: </span>
              <span className="text-body font-mono text-fg-primary">{user?.email}</span>
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
              삭제하려면 대상 이메일(<strong>{user?.email}</strong>)을 다시 입력하세요:
            </label>
            <input
              id="confirmEmail"
              type="text"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder={user?.email || ""}
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
              variant="destructive"
              disabled={!isConfirmed || isPending}
              data-testid="delete-user-submit"
            >
              {isPending ? "삭제 중..." : "삭제"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

