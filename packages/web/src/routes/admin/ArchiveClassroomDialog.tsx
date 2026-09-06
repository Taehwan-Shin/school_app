import { type FormEvent } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { useClassroomPatch } from '../../api/classroomPatch';

export interface ArchiveClassroomTarget {
  id: string;
  name?: string;
  currentState: string;
}

export interface ArchiveClassroomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: ArchiveClassroomTarget | null;
  onSuccess?: () => void;
}

export function ArchiveClassroomDialog({
  open,
  onOpenChange,
  target,
  onSuccess,
}: ArchiveClassroomDialogProps) {
  const { mutateAsync: patchClassroom, isPending, error: mutationError } = useClassroomPatch();

  if (!target) return null;

  const isArchive = target.currentState === 'ACTIVE';
  const isRestore = target.currentState === 'ARCHIVED';
  const isValidState = isArchive || isRestore;

  const nextState: 'ACTIVE' | 'ARCHIVED' = isArchive ? 'ARCHIVED' : 'ACTIVE';
  const actionText = isArchive ? '아카이브' : '복구';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isValidState) return;

    try {
      await patchClassroom({ id: target.id, courseState: nextState });
      onOpenChange(false);
      onSuccess?.();
    } catch {
      // Mutation error handled below
    }
  };

  const errorMessage = mutationError
    ? mutationError.message.includes('permission-denied')
      ? `${actionText} 권한이 없거나 스코프가 부족합니다.`
      : `${actionText} 실패: ${mutationError.message}`
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle className="text-h2 font-bold text-fg-primary">
              코스 {actionText} 확인
            </DialogTitle>
            <DialogDescription>
              {isArchive
                ? '이 코스를 아카이브합니다. 아카이브된 코스는 언제든지 복구할 수 있습니다.'
                : '이 코스를 활성 상태로 복구합니다.'}
            </DialogDescription>
          </DialogHeader>

          {errorMessage && (
            <div
              className="border border-state-danger p-3 text-small text-state-danger"
              data-testid="archive-classroom-error"
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

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              취소
            </Button>
            {isValidState && (
              <Button
                type="submit"
                variant="default"
                disabled={isPending}
                data-testid="archive-classroom-submit"
              >
                {isPending ? `${actionText} 중...` : actionText}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
