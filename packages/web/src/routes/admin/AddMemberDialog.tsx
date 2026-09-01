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
import { useAddMember } from '../../api/groupsMembersInsert';

export interface AddMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupEmail: string;
  onSuccess?: () => void;
}

export function AddMemberDialog({
  open,
  onOpenChange,
  groupEmail,
  onSuccess,
}: AddMemberDialogProps) {
  const [memberEmail, setMemberEmail] = useState('');
  const [role, setRole] = useState<'OWNER' | 'MANAGER' | 'MEMBER'>('MEMBER');
  const [validationError, setValidationError] = useState<string | null>(null);

  const { mutateAsync: addMember, isPending, error: mutationError } = useAddMember(groupEmail);

  const resetForm = () => {
    setMemberEmail('');
    setRole('MEMBER');
    setValidationError(null);
  };

  const handleClose = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const trimmedEmail = memberEmail.trim();
    if (!trimmedEmail) {
      setValidationError('멤버 이메일을 입력해주세요.');
      return;
    }

    if (!trimmedEmail.endsWith('@cam.hs.kr')) {
      setValidationError('이메일은 @cam.hs.kr 도메인이어야 합니다.');
      return;
    }

    try {
      await addMember({
        groupEmail,
        memberEmail: trimmedEmail,
        role,
      });
      onSuccess?.();
      handleClose(false);
    } catch {
      // Mutation error handled below
    }
  };

  const errorMessage =
    validationError ||
    (mutationError
      ? mutationError.message.includes('409') ||
        mutationError.message.includes('already_exists') ||
        mutationError.message.includes('already exists')
        ? '이 사용자는 이미 그룹의 멤버입니다.'
        : mutationError.message.includes('permission-denied') ||
          mutationError.message.includes('PERMISSION_DENIED')
        ? '멤버 추가 권한이 없거나 스코프가 부족합니다.'
        : `멤버 추가 실패: ${mutationError.message}`
      : null);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle>그룹 멤버 추가</DialogTitle>
            <DialogDescription>
              Google Workspace 그룹({groupEmail})에 새 멤버를 추가합니다.
            </DialogDescription>
          </DialogHeader>

          {errorMessage && (
            <div
              className="border border-state-danger p-3 text-small text-state-danger"
              data-testid="add-member-error"
            >
              {errorMessage}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="memberEmail" className="text-small text-fg-secondary mb-1 block">
              멤버 이메일 <span className="text-state-danger">*</span>
            </label>
            <input
              id="memberEmail"
              type="email"
              value={memberEmail}
              onChange={(e) => setMemberEmail(e.target.value)}
              placeholder="user@cam.hs.kr"
              className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
              data-testid="add-member-email"
            />
          </div>

          <div className="space-y-2">
            <span className="text-small text-fg-secondary mb-1 block">
              역할 <span className="text-state-danger">*</span>
            </span>
            <div className="flex gap-4">
              {(['MEMBER', 'MANAGER', 'OWNER'] as const).map((r) => (
                <label key={r} className="inline-flex items-center gap-2 cursor-pointer text-small text-fg-primary">
                  <input
                    type="radio"
                    name="memberRole"
                    value={r}
                    checked={role === r}
                    onChange={() => setRole(r)}
                    data-testid={`add-member-role-${r}`}
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
              disabled={isPending}
              data-testid="add-member-submit"
            >
              {isPending ? '추가 중...' : '추가'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
