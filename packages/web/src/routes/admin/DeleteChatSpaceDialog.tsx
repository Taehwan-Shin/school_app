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
import { useDeleteChatSpace } from '../../api/chatDelete';

export interface DeleteChatSpaceTarget {
  name: string;
  displayName?: string;
}

export interface DeleteChatSpaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  space: DeleteChatSpaceTarget | null;
  onSuccess?: () => void;
}

export function DeleteChatSpaceDialog({
  open,
  onOpenChange,
  space,
  onSuccess,
}: DeleteChatSpaceDialogProps) {
  const confirmPhrase = space?.displayName || space?.name || '';
  const [confirmText, setConfirmText] = useState('');
  const { mutateAsync: deleteChat, isPending, error: mutationError } = useDeleteChatSpace();

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

  const isConfirmed = space ? confirmText.trim() === confirmPhrase : false;

  const handleDelete = async (e: FormEvent) => {
    e.preventDefault();
    if (!space || !isConfirmed) return;

    try {
      await deleteChat({ name: space.name });
      handleClose(false);
      onSuccess?.();
    } catch {
      // Mutation error handled below
    }
  };

  const errorMessage = mutationError
    ? mutationError.message.includes('permission-denied')
      ? '챗방 삭제 권한이 없거나 스코프가 부족합니다.'
      : `챗방 삭제 실패: ${mutationError.message}`
    : null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <form onSubmit={handleDelete} className="space-y-6">
          <DialogHeader>
            <DialogTitle className="text-h2 font-bold text-state-danger">챗방 삭제 확인</DialogTitle>
            <DialogDescription>
              이 작업은 되돌릴 수 없습니다. 삭제된 챗방은 복구할 수 없습니다.
            </DialogDescription>
          </DialogHeader>

          {errorMessage && (
            <div
              className="border border-state-danger p-3 text-small text-state-danger"
              data-testid="delete-chat-error"
            >
              {errorMessage}
            </div>
          )}

          <div className="p-4 border border-border-subtle bg-surface space-y-2">
            <div>
              <span className="text-small text-fg-secondary">대상 챗방: </span>
              <span className="text-body font-mono text-fg-primary">{space?.name}</span>
            </div>
            {space?.displayName && (
              <div>
                <span className="text-small text-fg-secondary">챗방 이름: </span>
                <span className="text-body text-fg-primary">{space.displayName}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="delete-chat-confirm-input" className="text-small text-fg-secondary mb-1 block">
              삭제하려면 챗방 {space?.displayName ? '이름' : 'ID'}(<strong>{confirmPhrase}</strong>)을 다시 입력하세요:
            </label>
            <input
              id="delete-chat-confirm-input"
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={confirmPhrase}
              data-testid="delete-chat-confirm-input"
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
              data-testid="delete-chat-submit"
            >
              {isPending ? '삭제 중...' : '삭제'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
