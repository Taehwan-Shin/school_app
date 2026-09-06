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
import { useClassroomDelete } from '../../api/classroomDelete';

export interface DeleteClassroomTarget {
  id: string;
  name?: string;
}

export interface DeleteClassroomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: DeleteClassroomTarget | null;
  onSuccess?: () => void;
}

export function DeleteClassroomDialog({
  open,
  onOpenChange,
  target,
  onSuccess,
}: DeleteClassroomDialogProps) {
  const confirmPhrase = target?.name || target?.id || '';
  const [confirmText, setConfirmText] = useState('');
  const { mutateAsync: deleteClassroom, isPending, error: mutationError } = useClassroomDelete();

  useEffect(() => {
    if (open) {
      setConfirmText('');
    }
  }, [open]);

  const handleClose = (newOpen: boolean) => {
    if (!newOpen) {
      setConfirmText('');
    }
    onOpenChange(newOpen);
  };

  if (!target) return null;

  const isConfirmed = confirmText.trim() === confirmPhrase;

  const handleDelete = async (e: FormEvent) => {
    e.preventDefault();
    if (!isConfirmed) return;

    try {
      await deleteClassroom({ id: target.id });
      handleClose(false);
      onSuccess?.();
    } catch {
      // Mutation error handled below
    }
  };

  const errorMessage = mutationError
    ? mutationError.message.includes('google_upstream_not_found') ||
      mutationError.message.includes('not-found') ||
      (mutationError as any).status === 404
      ? '이미 삭제된 코스이거나 찾을 수 없습니다.'
      : mutationError.message.includes('permission-denied')
        ? '코스 삭제 권한이 없거나 스코프가 부족합니다.'
        : `코스 삭제 실패: ${mutationError.message}`
    : null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <form onSubmit={handleDelete} className="space-y-6">
          <DialogHeader>
            <DialogTitle className="text-h2 font-bold text-state-danger">클래스룸 코스 삭제 확인</DialogTitle>
            <DialogDescription>
              이 작업은 되돌릴 수 없습니다. 삭제된 코스는 복구할 수 없습니다.
            </DialogDescription>
          </DialogHeader>

          {errorMessage && (
            <div
              className="border border-state-danger p-3 text-small text-state-danger"
              data-testid="delete-classroom-error"
            >
              {errorMessage}
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
          </div>

          <div className="space-y-2">
            <label htmlFor="delete-classroom-confirm-input" className="text-small text-fg-secondary mb-1 block">
              삭제하려면 코스 {target.name ? '이름' : 'ID'}(<strong>{confirmPhrase}</strong>)을 다시 입력하세요:
            </label>
            <input
              id="delete-classroom-confirm-input"
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={confirmPhrase}
              data-testid="delete-classroom-confirm-input"
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
              data-testid="delete-classroom-submit"
            >
              {isPending ? '삭제 중...' : '삭제'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
