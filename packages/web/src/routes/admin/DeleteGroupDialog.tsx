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
import { useDeleteGroup } from "../../api/groupsDelete";

export interface DeleteGroupTarget {
  email: string;
  name: string;
}

export interface DeleteGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: DeleteGroupTarget | null;
  onSuccess?: () => void;
}

export function DeleteGroupDialog({
  open,
  onOpenChange,
  group,
  onSuccess,
}: DeleteGroupDialogProps) {
  const [confirmEmail, setConfirmEmail] = useState("");
  const { mutateAsync: deleteGroup, isPending, error: mutationError } = useDeleteGroup();

  const handleClose = (newOpen: boolean) => {
    if (!newOpen) {
      setConfirmEmail("");
    }
    onOpenChange(newOpen);
  };

  const isConfirmed = group ? confirmEmail.trim() === group.email.trim() : false;

  const handleDelete = async (e: FormEvent) => {
    e.preventDefault();
    if (!group || !isConfirmed) return;

    try {
      await deleteGroup({ email: group.email.trim() });
      handleClose(false);
      onSuccess?.();
    } catch {
      // Mutation error handled below
    }
  };

  const errorMessage = mutationError
    ? mutationError.message.includes("permission-denied")
      ? "그룹 삭제 권한이 없거나 스코프가 부족합니다."
      : `그룹 삭제 실패: ${mutationError.message}`
    : null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <form onSubmit={handleDelete} className="space-y-6">
          <DialogHeader>
            <DialogTitle className="text-h2 font-bold text-fg-primary">그룹 삭제 확인</DialogTitle>
            <DialogDescription>
              이 작업은 되돌릴 수 없습니다. 그룹의 모든 멤버십이 자동 해제됩니다.
            </DialogDescription>
          </DialogHeader>

          {errorMessage && (
            <div
              className="border border-state-danger p-3 text-small text-state-danger"
              data-testid="delete-group-error"
            >
              {errorMessage}
            </div>
          )}

          <div className="p-4 border border-border-subtle bg-surface space-y-2">
            <div>
              <span className="text-small text-fg-secondary">대상 그룹: </span>
              <span className="text-body font-mono text-fg-primary">{group?.email}</span>
            </div>
            {group?.name && (
              <div>
                <span className="text-small text-fg-secondary">그룹 이름: </span>
                <span className="text-body text-fg-primary">{group.name}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="confirmEmail" className="text-small text-fg-secondary mb-1 block">
              삭제하려면 그룹 이메일(<strong>{group?.email}</strong>)을 다시 입력하세요:
            </label>
            <input
              id="confirmEmail"
              type="text"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder={group?.email || ""}
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
              data-testid="delete-group-submit"
            >
              {isPending ? "삭제 중..." : "삭제"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
