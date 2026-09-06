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
import { useCreateChatSpace } from '../../api/chatCreate';

export interface CreateChatSpaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateChatSpaceDialog({ open, onOpenChange }: CreateChatSpaceDialogProps) {
  const [displayName, setDisplayName] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const { mutateAsync: createChat, isPending, error: mutationError } = useCreateChatSpace();

  useEffect(() => {
    if (open) {
      setDisplayName('');
      setValidationError(null);
    }
  }, [open]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    const trimmed = displayName.trim();
    if (trimmed.length === 0) {
      setValidationError('챗방 이름이 필요합니다.');
      return;
    }
    try {
      await createChat({ displayName: trimmed });
      onOpenChange(false);
    } catch {
      // mutationError 표시
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>새 챗방 생성</DialogTitle>
            <DialogDescription>Google Chat 스페이스를 새로 만듭니다.</DialogDescription>
          </DialogHeader>
          <div>
            <label htmlFor="create-chat-name-input" className="text-small text-fg-secondary mb-1 block">
              이름
            </label>
            <input
              id="create-chat-name-input"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="예: 2026년 1학년 A반"
              data-testid="create-chat-name-input"
              className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
            />
          </div>
          {validationError && (
            <div
              className="border border-state-danger p-4 text-small text-state-danger"
              data-testid="create-chat-validation-error"
            >
              {validationError}
            </div>
          )}
          {mutationError && (
            <div
              className="border border-state-danger p-4 text-small text-state-danger"
              data-testid="create-chat-error"
            >
              생성 실패: {mutationError.message}
            </div>
          )}
          <DialogFooter>
            <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button type="submit" disabled={isPending} data-testid="create-chat-submit">
              {isPending ? '생성 중...' : '생성'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
