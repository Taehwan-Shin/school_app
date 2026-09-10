import { useEffect, useState, type FormEvent } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { useClassroomTransferOwnership } from '../../api/classroomTransferOwnership';

export interface TransferClassroomOwnerTarget {
  id: string;
  name?: string;
  currentOwnerId?: string;
}

export interface TransferClassroomOwnerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: TransferClassroomOwnerTarget | null;
  onSuccess?: () => void;
}

// v0.116: 원본 Apps Script transferClassroomOwnershipAndUpdateSheet 포팅.
// 새 owner 이메일 입력 → server 가 teachers.get 404 시 사전 create → patch(ownerId).
// admin/super_admin 만 실행 가능 (`classroom.transfer_owner` cap).
export function TransferClassroomOwnerDialog({
  open,
  onOpenChange,
  target,
  onSuccess,
}: TransferClassroomOwnerDialogProps) {
  const {
    mutateAsync: transferOwnership,
    isPending,
    error: mutationError,
    data: mutationResult,
    reset,
  } = useClassroomTransferOwnership();
  const [newOwnerEmail, setNewOwnerEmail] = useState('');

  useEffect(() => {
    if (open) {
      setNewOwnerEmail('');
      reset();
    }
  }, [open, reset]);

  if (!target) return null;

  const trimmed = newOwnerEmail.trim();
  const isValidEmail = /^[A-Za-z0-9._+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/.test(trimmed);
  const isSameAsCurrent =
    !!target.currentOwnerId && trimmed.toLowerCase() === target.currentOwnerId.toLowerCase();
  const canSubmit = isValidEmail && !isSameAsCurrent && !isPending;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    try {
      await transferOwnership({ courseId: target.id, newOwnerEmail: trimmed });
      onSuccess?.();
    } catch {
      // Mutation error rendered below.
    }
  };

  const errorMessage = mutationError
    ? mutationError.message.includes('permission-denied')
      ? '이관 권한이 없거나 스코프가 부족합니다.'
      : mutationError.message.includes('invalid_new_owner_email')
        ? '새 소유자 이메일 형식이 올바르지 않습니다.'
        : `이관 실패: ${mutationError.message}`
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle className="text-h2 font-bold text-fg-primary">
              클래스룸 소유자 이관
            </DialogTitle>
            <DialogDescription>
              새 소유자는 도메인 사용자여야 하며, 코스 교사가 아니면 서버가 자동으로 교사로
              추가한 뒤 이관합니다.
            </DialogDescription>
          </DialogHeader>

          {errorMessage && (
            <div
              className="border border-state-danger p-3 text-small text-state-danger"
              data-testid="transfer-owner-error"
            >
              {errorMessage}
            </div>
          )}

          {mutationResult && (
            <div
              className="border border-state-success p-3 text-small text-fg-primary"
              data-testid="transfer-owner-success"
            >
              이관 완료.
              {mutationResult.addedAsTeacher
                ? ' 새 소유자를 교사로 자동 추가한 뒤 이관했습니다.'
                : ' (새 소유자는 이미 교사였습니다.)'}
            </div>
          )}

          <div className="p-4 border border-border-subtle bg-surface space-y-2">
            <div>
              <span className="text-small text-fg-secondary">대상 코스 ID: </span>
              <span className="text-body font-mono text-fg-primary">{target.id}</span>
            </div>
            {target.name && (
              <div>
                <span className="text-small text-fg-secondary">코스 이름: </span>
                <span className="text-body text-fg-primary">{target.name}</span>
              </div>
            )}
            {target.currentOwnerId && (
              <div>
                <span className="text-small text-fg-secondary">현재 소유자: </span>
                <span className="text-body font-mono text-fg-primary">
                  {target.currentOwnerId}
                </span>
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="transfer-owner-new-email"
              className="text-small text-fg-primary block mb-2"
            >
              새 소유자 이메일:
            </label>
            <input
              id="transfer-owner-new-email"
              type="email"
              value={newOwnerEmail}
              onChange={(e) => setNewOwnerEmail(e.target.value)}
              placeholder="newowner@example.com"
              disabled={isPending || !!mutationResult}
              data-testid="transfer-owner-email-input"
              className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong disabled:opacity-60"
            />
            {trimmed && !isValidEmail && (
              <p className="mt-1 text-small text-state-danger" data-testid="transfer-owner-email-hint">
                이메일 형식이 아닙니다.
              </p>
            )}
            {isSameAsCurrent && (
              <p className="mt-1 text-small text-state-danger" data-testid="transfer-owner-same-hint">
                현재 소유자와 같습니다.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              data-testid="transfer-owner-cancel-btn"
            >
              {mutationResult ? '닫기' : '취소'}
            </Button>
            {!mutationResult && (
              <Button
                type="submit"
                variant="default"
                disabled={!canSubmit}
                data-testid="transfer-owner-submit-btn"
              >
                {isPending ? '이관 중...' : '이관'}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
