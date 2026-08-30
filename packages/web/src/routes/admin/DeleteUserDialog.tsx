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
      <DialogContent className="sm:max-w-[440px]">
        <form onSubmit={handleDelete}>
          <DialogHeader>
            <DialogTitle className="text-red-600">계정 삭제 확인</DialogTitle>
            <DialogDescription>
              이 작업은 되돌릴 수 없습니다. Google Workspace 에서 계정이 영구적으로 삭제됩니다.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {errorMessage && (
              <div
                className="p-3 text-sm rounded bg-red-50 border border-red-200 text-red-700"
                data-testid="delete-user-error"
              >
                {errorMessage}
              </div>
            )}

            <div className="p-3 bg-slate-50 border border-slate-200 rounded text-sm space-y-1">
              <div>
                <span className="text-slate-500">대상 계정: </span>
                <strong className="text-slate-900">{user?.email}</strong>
              </div>
              {fullName && (
                <div>
                  <span className="text-slate-500">사용자 이름: </span>
                  <span className="text-slate-900">{fullName}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="confirmEmail" className="block text-xs font-medium text-slate-700">
                삭제를 확인하려면 계정 이메일(<strong>{user?.email}</strong>)을 그대로 입력하세요:
              </label>
              <input
                id="confirmEmail"
                type="text"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder={user?.email || ""}
                className="w-full h-9 px-3 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
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
              {isPending ? "삭제 중..." : "영구 삭제"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
