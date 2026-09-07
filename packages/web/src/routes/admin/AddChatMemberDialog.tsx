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
import { useChatMembersAdd } from '../../api/chatMembersAdd';

export interface AddChatMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceName: string;
  spaceDisplayName?: string;
  onSuccess?: () => void;
}

export function AddChatMemberDialog({
  open,
  onOpenChange,
  spaceName,
  spaceDisplayName,
  onSuccess,
}: AddChatMemberDialogProps) {
  const [email, setEmail] = useState('');
  const addMutation = useChatMembersAdd();

  useEffect(() => {
    if (open) {
      setEmail('');
      addMutation.reset?.();
    }
  }, [open]);

  const handleOpenChange = (next: boolean) => {
    if (!next && addMutation.isPending) return;
    if (!next) {
      setEmail('');
      addMutation.reset?.();
    }
    onOpenChange(next);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;

    try {
      await addMutation.mutateAsync({
        spaceName,
        email: trimmed,
      });
      handleOpenChange(false);
      onSuccess?.();
    } catch {
      // Handled by error banner below
    }
  };

  const canSubmit = !addMutation.isPending && Boolean(email.trim());

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form
          onSubmit={handleSubmit}
          className="space-y-6"
          data-testid="add-chat-member-form"
        >
          <DialogHeader>
            <DialogTitle>
              {spaceDisplayName || spaceName} 멤버 추가
            </DialogTitle>
            <DialogDescription>
              <span className="font-mono">{spaceName}</span> 에 새 멤버를 추가합니다. 이메일 주소를 입력하면 사용자 식별자로 자동 변환됩니다.
            </DialogDescription>
          </DialogHeader>

          {addMutation.isError && (
            <div
              className="border border-state-danger p-3 text-small text-state-danger"
              data-testid="add-chat-member-error"
            >
              {addMutation.error?.message || '알 수 없는 오류'}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="add-chat-member-email-input" className="text-small text-fg-secondary mb-1 block">
              이메일 <span className="text-state-danger">*</span>
            </label>
            <input
              id="add-chat-member-email-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@cam.hs.kr"
              disabled={addMutation.isPending}
              className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong disabled:opacity-50"
              data-testid="add-chat-member-email"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleOpenChange(false)}
              disabled={addMutation.isPending}
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit}
              data-testid="add-chat-member-submit"
            >
              {addMutation.isPending ? '추가 중...' : '추가'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
