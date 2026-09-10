import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { callClassroomPatch } from '../../api/classroomPatch';

export type BulkArchiveDirection = 'archive' | 'restore';

export interface BulkArchiveClassroomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courses: { id: string; name?: string }[]; // 이미 방향별로 필터된 대상만 전달.
  direction: BulkArchiveDirection;
  onDone?: () => void;
}

type Phase = 'confirm' | 'running' | 'done';

// v0.115: 원본 Apps Script archiveClassrooms 포팅. courseState 를 ACTIVE ↔ ARCHIVED
// 로 순차 전환. classroomPatch callable 을 for-loop 호출, 개별 실패 수집.
export function BulkArchiveClassroomDialog({
  open,
  onOpenChange,
  courses,
  direction,
  onDone,
}: BulkArchiveClassroomDialogProps) {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>('confirm');
  const [progress, setProgress] = useState(0);
  const [failures, setFailures] = useState<{ id: string; message: string }[]>([]);
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    if (open) {
      setPhase('confirm');
      setProgress(0);
      setFailures([]);
      setConfirmText('');
    }
  }, [open]);

  const handleOpenChange = (newOpen: boolean) => {
    if (phase === 'running') return;
    if (!newOpen) {
      setConfirmText('');
      if (phase === 'done') onDone?.();
    }
    onOpenChange(newOpen);
  };

  const targetState: 'ARCHIVED' | 'ACTIVE' = direction === 'archive' ? 'ARCHIVED' : 'ACTIVE';
  const actionLabel = direction === 'archive' ? '아카이브' : '복구';

  const handleConfirm = async () => {
    setPhase('running');
    const localFailures: { id: string; message: string }[] = [];
    for (let i = 0; i < courses.length; i++) {
      const c = courses[i];
      try {
        await callClassroomPatch({ id: c.id, courseState: targetState });
      } catch (e) {
        localFailures.push({ id: c.id, message: (e as Error).message });
      }
      setProgress(i + 1);
    }
    setFailures(localFailures);
    setPhase('done');
    queryClient.invalidateQueries({ queryKey: ['classroom', 'list'] });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={phase === 'running' ? '[&>button]:hidden' : undefined}>
        {phase === 'confirm' && (
          <>
            <DialogHeader>
              <DialogTitle>클래스룸 일괄 {actionLabel} 확인</DialogTitle>
              <DialogDescription>
                선택한 {courses.length}개 코스를 {actionLabel}합니다. 되돌리려면 반대 방향
                일괄 작업 또는 개별 「{direction === 'archive' ? '복구' : '아카이브'}」.
              </DialogDescription>
            </DialogHeader>
            <ul className="text-small text-fg-secondary max-h-40 overflow-y-auto space-y-1">
              {courses.slice(0, 5).map((c) => (
                <li key={c.id} className="font-mono">
                  {c.name || c.id}
                </li>
              ))}
              {courses.length > 5 && (
                <li className="text-fg-muted">... 외 {courses.length - 5}개</li>
              )}
            </ul>
            <div>
              <label
                htmlFor="bulk-archive-classroom-confirm-input"
                className="text-small text-fg-primary block mb-2"
              >
                확인을 위해 대상 개수 (<strong>{courses.length}</strong>)를 입력하세요:
              </label>
              <input
                id="bulk-archive-classroom-confirm-input"
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                data-testid="bulk-archive-classroom-confirm-input"
                className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
              />
            </div>
            <DialogFooter>
              <Button
                variant="secondary"
                onClick={() => handleOpenChange(false)}
                data-testid="bulk-archive-classroom-cancel-btn"
              >
                취소
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={
                  confirmText.trim() !== String(courses.length) || courses.length === 0
                }
                data-testid="bulk-archive-classroom-confirm-btn"
              >
                {courses.length}개 {actionLabel}
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === 'running' && (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>일괄 {actionLabel} 진행 중</DialogTitle>
              <DialogDescription>클래스룸 상태를 변경하고 있습니다.</DialogDescription>
            </DialogHeader>
            <div
              className="py-8 text-center space-y-3"
              data-testid="bulk-archive-classroom-running"
            >
              <div className="text-body text-fg-primary">
                진행 중: <strong className="font-mono">{progress}</strong> /{' '}
                <strong className="font-mono">{courses.length}</strong>
              </div>
              <div className="w-full bg-canvas h-2 border border-border-subtle">
                <div
                  className="bg-fg-primary h-full transition-all"
                  style={{
                    width: `${courses.length > 0 ? (progress / courses.length) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </>
        )}

        {phase === 'done' && (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>일괄 {actionLabel} 완료</DialogTitle>
              <DialogDescription>일괄 작업이 완료되었습니다.</DialogDescription>
            </DialogHeader>
            <div data-testid="bulk-archive-classroom-done" className="space-y-3">
              <p className="text-body text-fg-primary">
                완료:{' '}
                <strong className="text-state-success font-mono">
                  {courses.length - failures.length}
                </strong>
                개 성공
                {failures.length > 0 && (
                  <>
                    {' · '}
                    <strong className="text-state-danger font-mono">
                      {failures.length}
                    </strong>
                    개 실패
                  </>
                )}
              </p>
              {failures.length > 0 && (
                <ul
                  className="text-small text-state-danger space-y-1 max-h-40 overflow-y-auto"
                  data-testid="bulk-archive-classroom-failures"
                >
                  {failures.map((f) => (
                    <li key={f.id}>
                      <span className="font-mono">{f.id}</span>: {f.message}
                    </li>
                  ))}
                </ul>
              )}
              <DialogFooter>
                <Button onClick={() => handleOpenChange(false)}>확인</Button>
              </DialogFooter>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
