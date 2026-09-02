import { useState, useEffect, type FormEvent } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { useUpdateMemberRole } from '../../api/groupsMembersUpdate';

export interface EditMemberRoleDialogProps {
  groupEmail: string;
  memberEmail: string;
  currentRole: 'OWNER' | 'MANAGER' | 'MEMBER' | string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditMemberRoleDialog({
  groupEmail,
  memberEmail,
  currentRole,
  open,
  onOpenChange,
  onSuccess,
}: EditMemberRoleDialogProps) {
  const [role, setRole] = useState<'OWNER' | 'MANAGER' | 'MEMBER'>('MEMBER');

  const { mutateAsync: updateRole, isPending, error: mutationError } = useUpdateMemberRole(groupEmail);

  useEffect(() => {
    if (open) {
      if (currentRole === 'OWNER' || currentRole === 'MANAGER' || currentRole === 'MEMBER') {
        setRole(currentRole);
      } else {
        setRole('MEMBER');
      }
    }
  }, [open, currentRole]);

  const handleClose = (newOpen: boolean) => {
    onOpenChange(newOpen);
  };

  const isUnchanged = role === currentRole;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isUnchanged) {
      return;
    }

    try {
      await updateRole({
        groupEmail,
        memberEmail,
        role,
      });
      onSuccess?.();
      handleClose(false);
    } catch {
      // Mutation error handled below
    }
  };

  const errorMessage = mutationError
    ? mutationError.message.includes('permission-denied') ||
      mutationError.message.includes('PERMISSION_DENIED')
      ? '역할 변경 권한이 없거나 스코프가 부족합니다.'
      : mutationError.message.includes('cannot_downgrade') ||
        mutationError.message.includes('only owner') ||
        mutationError.message.includes('Cannot downgrade the only owner')
      ? '마지막 소유자의 역할은 변경할 수 없습니다.'
      : `역할 변경 실패: ${mutationError.message}`
    : null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent data-testid="edit-member-role-dialog">
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle>그룹 멤버 역할 변경</DialogTitle>
            <DialogDescription>
              Google Workspace 그룹 멤버의 역할을 변경합니다.
            </DialogDescription>
          </DialogHeader>

          {errorMessage && (
            <div
              className="border border-state-danger p-3 text-small text-state-danger"
              data-testid="edit-member-role-error"
            >
              {errorMessage}
            </div>
          )}

          <div className="space-y-3 bg-surface p-4 border border-border-subtle text-small">
            <div className="flex justify-between">
              <span className="text-fg-secondary">그룹</span>
              <span className="font-mono text-fg-primary">{groupEmail}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-fg-secondary">멤버 이메일</span>
              <span className="font-mono text-fg-primary">{memberEmail}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-fg-secondary">현재 역할</span>
              <span className="font-medium text-fg-primary">{currentRole}</span>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-small text-fg-secondary mb-1 block">
              새 역할 <span className="text-state-danger">*</span>
            </span>
            <div className="flex gap-4">
              {(['MEMBER', 'MANAGER', 'OWNER'] as const).map((r) => (
                <label
                  key={r}
                  className="inline-flex items-center gap-2 cursor-pointer text-small text-fg-primary"
                >
                  <input
                    type="radio"
                    name="editMemberRole"
                    value={r}
                    checked={role === r}
                    onChange={() => setRole(r)}
                    data-testid={`edit-member-role-${r}`}
                  />
                  <span>{r}</span>
                </label>
              ))}
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
              disabled={isPending || isUnchanged}
              data-testid="edit-member-role-submit"
            >
              {isPending ? '변경 중...' : '변경'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
