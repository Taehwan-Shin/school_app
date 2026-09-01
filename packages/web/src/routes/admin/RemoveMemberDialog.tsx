import { useState, type FormEvent } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { useRemoveMember } from '../../api/groupsMembersDelete';

export interface RemoveMemberTarget {
  email: string;
  role: string;
}

export interface RemoveMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupEmail: string;
  member: RemoveMemberTarget | null;
  onSuccess?: () => void;
}

export function RemoveMemberDialog({
  open,
  onOpenChange,
  groupEmail,
  member,
  onSuccess,
}: RemoveMemberDialogProps) {
  const [confirmEmail, setConfirmEmail] = useState('');
  const { mutateAsync: removeMember, isPending, error: mutationError } = useRemoveMember(groupEmail);

  const handleClose = (newOpen: boolean) => {
    if (!newOpen) {
      setConfirmEmail('');
    }
    onOpenChange(newOpen);
  };

  const isConfirmed = member ? confirmEmail.trim() === member.email.trim() : false;

  const handleRemove = async (e: FormEvent) => {
    e.preventDefault();
    if (!member || !isConfirmed) return;

    try {
      await removeMember({
        groupEmail,
        memberEmail: member.email.trim(),
      });
      onSuccess?.();
      handleClose(false);
    } catch {
      // Mutation error handled below
    }
  };

  const errorMessage = mutationError
    ? mutationError.message.includes('last_owner') ||
      mutationError.message.includes('last owner') ||
      mutationError.message.includes('cannot_remove_last_owner')
      ? '마지막 소유자는 제거할 수 없습니다.'
      : mutationError.message.includes('permission-denied') ||
        mutationError.message.includes('PERMISSION_DENIED')
      ? '멤버 제거 권한이 없거나 스코프가 부족합니다.'
      : `멤버 제거 실패: ${mutationError.message}`
    : null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <form onSubmit={handleRemove} className="space-y-6">
          <DialogHeader>
            <DialogTitle className="text-h2 font-bold text-fg-primary">멤버 제거 확인</DialogTitle>
            <DialogDescription>
              이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>

          {errorMessage && (
            <div
              className="border border-state-danger p-3 text-small text-state-danger"
              data-testid="remove-member-error"
            >
              {errorMessage}
            </div>
          )}

          <div className="p-4 border border-border-subtle bg-surface space-y-2">
            <div>
              <span className="text-small text-fg-secondary">대상 그룹: </span>
              <span className="text-body font-mono text-fg-primary">{groupEmail}</span>
            </div>
            <div>
              <span className="text-small text-fg-secondary">대상 멤버: </span>
              <span className="text-body font-mono text-fg-primary">{member?.email}</span>
            </div>
            {member?.role && (
              <div>
                <span className="text-small text-fg-secondary">역할: </span>
                <span className="text-body text-fg-primary">{member.role}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="confirmMemberEmail" className="text-small text-fg-secondary mb-1 block">
              제거하려면 멤버 이메일(<strong>{member?.email}</strong>)을 다시 입력하세요:
            </label>
            <input
              id="confirmMemberEmail"
              type="text"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder={member?.email || ''}
              className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
              data-testid="remove-member-confirm-input"
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
              data-testid="remove-member-submit"
            >
              {isPending ? '제거 중...' : '제거'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
