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
// v0.189: hardcoded NAME_MAX/SECTION_MAX 를 shared `lib/classroomLimits.ts` 로 승격
// (v0.175 CreateClassroom 검증에서 이미 사용 중).
import { COURSE_NAME_MAX, COURSE_SECTION_MAX } from '../../lib/classroomLimits';

export interface RenameClassroomTarget {
  id: string;
  name?: string;
  section?: string;
}

export interface RenameClassroomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: RenameClassroomTarget | null;
  onDone?: () => void;
}

// v0.136: 개별 클래스룸 이름/섹션 변경 다이얼로그. v0.134 의 classroomPatch
// name/section 확장을 개별 편집 (classroomDetail 페이지) 에서도 사용 가능하게.
// v0.189: shared classroomLimits 로 이관 (하위 호환 alias).
const NAME_MAX = COURSE_NAME_MAX;
const SECTION_MAX = COURSE_SECTION_MAX;

export function RenameClassroomDialog({
  open,
  onOpenChange,
  target,
  onDone,
}: RenameClassroomDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [section, setSection] = useState('');
  const [phase, setPhase] = useState<'edit' | 'running' | 'done'>('edit');
  const [error, setError] = useState<string | null>(null);
  // v0.136: 대상 snapshot — 편집 중 target prop 이 재계산돼도 원본 유지.
  const [snapshot, setSnapshot] = useState<RenameClassroomTarget | null>(null);

  useEffect(() => {
    if (open && target) {
      setName(target.name ?? '');
      setSection(target.section ?? '');
      setPhase('edit');
      setError(null);
      setSnapshot({ id: target.id, name: target.name, section: target.section });
    }
    // v0.136: target 을 dep 에서 제외 (v0.134 BulkRename 대칭). 열려있는 다이얼로그의
    // 편집 상태를 부모 list invalidation 으로부터 보호. 재열기는 부모 조건부 render 로.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleOpenChange = (newOpen: boolean) => {
    if (phase === 'running') return;
    if (!newOpen && phase === 'done') onDone?.();
    onOpenChange(newOpen);
  };

  const active = snapshot ?? target;
  const trimmedName = name.trim();
  const trimmedSection = section.trim();
  const originalName = (active?.name ?? '').trim();
  const originalSection = (active?.section ?? '').trim();

  const nameChanged = trimmedName !== originalName;
  const sectionChanged = trimmedSection !== originalSection;
  const nameEmpty = trimmedName.length === 0;
  const nameTooLong = trimmedName.length > NAME_MAX;
  const sectionTooLong = trimmedSection.length > SECTION_MAX;
  const anyChanged = nameChanged || sectionChanged;
  const invalid = nameEmpty || nameTooLong || sectionTooLong;

  const handleSubmit = async () => {
    if (!active || !anyChanged || invalid) return;
    setPhase('running');
    setError(null);
    try {
      const req: {
        id: string;
        name?: string;
        section?: string;
      } = { id: active.id };
      if (nameChanged) req.name = trimmedName;
      if (sectionChanged) req.section = trimmedSection;
      await callClassroomPatch(req);
      setPhase('done');
      queryClient.invalidateQueries({ queryKey: ['classroom', 'list'] });
    } catch (e) {
      setError((e as Error).message);
      setPhase('edit');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={phase === 'running' ? '[&>button]:hidden' : undefined}>
        {phase === 'edit' && (
          <>
            <DialogHeader>
              <DialogTitle>코스 이름 · 섹션 변경</DialogTitle>
              <DialogDescription>
                코스 ID{' '}
                <span className="font-mono text-fg-secondary">{active?.id ?? '-'}</span> 의
                이름과 섹션을 변경합니다. 변경된 필드만 서버에 반영됩니다.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="rename-classroom-name-input"
                  className="text-small text-fg-primary block mb-1"
                >
                  이름 (최대 {NAME_MAX}자)
                </label>
                <input
                  id="rename-classroom-name-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  data-testid="rename-classroom-name-input"
                  aria-invalid={nameEmpty || nameTooLong || undefined}
                  className={
                    'w-full border bg-canvas px-3 py-2 text-body focus:outline-none focus:ring-1 ' +
                    (nameEmpty || nameTooLong
                      ? 'border-state-danger text-state-danger focus:border-state-danger focus:ring-state-danger'
                      : nameChanged
                        ? 'border-fg-primary text-fg-primary focus:border-fg-primary focus:ring-fg-primary'
                        : 'border-border-subtle text-fg-primary focus:border-border-strong focus:ring-border-strong')
                  }
                />
                {/* v0.189: v0.180/v0.188 counter 스타일 통일 카운터. */}
                <p
                  className={`mt-1 text-small ${
                    nameTooLong ? 'text-state-danger' : 'text-fg-muted'
                  }`}
                  data-testid="rename-classroom-name-counter"
                >
                  {trimmedName.length.toLocaleString()} / {NAME_MAX.toLocaleString()} 자
                </p>
                {nameEmpty && (
                  <p
                    className="text-small text-state-danger mt-1"
                    data-testid="rename-classroom-name-empty"
                  >
                    이름은 비어있을 수 없습니다.
                  </p>
                )}
                {nameTooLong && (
                  <p
                    className="text-small text-state-danger mt-1"
                    data-testid="rename-classroom-name-too-long"
                  >
                    이름은 최대 {NAME_MAX}자까지 (현재 {trimmedName.length}자).
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="rename-classroom-section-input"
                  className="text-small text-fg-primary block mb-1"
                >
                  섹션 (선택, 최대 {SECTION_MAX}자)
                </label>
                <input
                  id="rename-classroom-section-input"
                  type="text"
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  data-testid="rename-classroom-section-input"
                  aria-invalid={sectionTooLong || undefined}
                  className={
                    'w-full border bg-canvas px-3 py-2 text-body focus:outline-none focus:ring-1 ' +
                    (sectionTooLong
                      ? 'border-state-danger text-state-danger focus:border-state-danger focus:ring-state-danger'
                      : sectionChanged
                        ? 'border-fg-primary text-fg-primary focus:border-fg-primary focus:ring-fg-primary'
                        : 'border-border-subtle text-fg-primary focus:border-border-strong focus:ring-border-strong')
                  }
                />
                {/* v0.189: 카운터 (v0.180 스타일). */}
                <p
                  className={`mt-1 text-small ${
                    sectionTooLong ? 'text-state-danger' : 'text-fg-muted'
                  }`}
                  data-testid="rename-classroom-section-counter"
                >
                  {trimmedSection.length.toLocaleString()} / {SECTION_MAX.toLocaleString()} 자
                </p>
                {sectionTooLong && (
                  <p
                    className="text-small text-state-danger mt-1"
                    data-testid="rename-classroom-section-too-long"
                  >
                    섹션은 최대 {SECTION_MAX}자까지 (현재 {trimmedSection.length}자).
                  </p>
                )}
                <p className="text-small text-fg-muted mt-1">
                  빈 값으로 저장하면 섹션이 삭제됩니다.
                </p>
              </div>
              {error && (
                <p
                  className="text-small text-state-danger"
                  data-testid="rename-classroom-error"
                >
                  변경 실패: {error}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="secondary"
                onClick={() => handleOpenChange(false)}
                data-testid="rename-classroom-cancel-btn"
              >
                취소
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!anyChanged || invalid}
                data-testid="rename-classroom-confirm-btn"
              >
                변경 저장
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === 'running' && (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>변경 저장 중</DialogTitle>
              <DialogDescription>클래스룸을 변경하고 있습니다.</DialogDescription>
            </DialogHeader>
            <div
              className="py-8 text-center text-body text-fg-primary"
              data-testid="rename-classroom-running"
            >
              변경 저장 중...
            </div>
          </>
        )}

        {phase === 'done' && (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>변경 완료</DialogTitle>
              <DialogDescription>변경이 완료되었습니다.</DialogDescription>
            </DialogHeader>
            <div data-testid="rename-classroom-done" className="space-y-3">
              <p className="text-body text-state-success">변경이 저장되었습니다.</p>
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
