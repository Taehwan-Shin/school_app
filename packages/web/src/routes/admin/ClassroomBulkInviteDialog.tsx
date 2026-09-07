import { useState, useEffect, useMemo, useContext } from 'react';
import { QueryClientContext } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { useBasicDataGet } from '../../api/basicDataGet';
import { useClassroomStudentsAdd } from '../../api/classroomStudentsAdd';

export interface ClassroomBulkInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  courseName?: string;
  onDone?: () => void;
}

export function isAlreadyMemberError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('already') ||
    lower.includes('duplicate') ||
    lower.includes('member exists') ||
    lower.includes('409')
  );
}

type Phase = 'select' | 'preview' | 'running' | 'done';
type ResultKind = 'ok' | 'skipped' | 'failed';

interface BulkInviteResult {
  email: string;
  kind: ResultKind;
  message?: string;
}

function ClassroomBulkInviteDialogContent({
  open,
  onOpenChange,
  courseId,
  courseName,
  onDone,
}: ClassroomBulkInviteDialogProps) {
  const queryClient = useContext(QueryClientContext);
  const thisYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(thisYear);
  const [yearInput, setYearInput] = useState(String(thisYear));
  const [phase, setPhase] = useState<Phase>('select');
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<BulkInviteResult[]>([]);

  const basicDataQuery = useBasicDataGet(selectedYear, open);
  const studentAddMutation = useClassroomStudentsAdd();

  const grades = basicDataQuery.data?.data?.grades ?? [];
  const rosters = basicDataQuery.data?.data?.rosters ?? {};

  const targets = useMemo(() => {
    if (selectedGrade === null || selectedClass === null) return [];
    return rosters[String(selectedGrade)]?.[selectedClass] ?? [];
  }, [rosters, selectedGrade, selectedClass]);

  useEffect(() => {
    if (open) {
      setPhase('select');
      setSelectedGrade(null);
      setSelectedClass(null);
      setConfirmText('');
      setProgress(0);
      setResults([]);
    }
  }, [open, courseId]);

  const handleOpenChange = (next: boolean) => {
    if (phase === 'running') return;
    onOpenChange(next);
  };

  const handleYearChange = (val: string) => {
    setYearInput(val);
    const parsed = Number.parseInt(val, 10);
    if (Number.isFinite(parsed) && parsed >= 1900 && parsed <= 2200) {
      setSelectedYear(parsed);
      setSelectedGrade(null);
      setSelectedClass(null);
    }
  };

  const handleExecute = async () => {
    if (targets.length === 0 || confirmText.trim() !== String(targets.length)) return;
    setPhase('running');
    setProgress(0);
    const localResults: BulkInviteResult[] = [];

    for (let i = 0; i < targets.length; i++) {
      const email = targets[i];
      try {
        await studentAddMutation.mutateAsync({ courseId, userId: email });
        localResults.push({ email, kind: 'ok' });
      } catch (err) {
        const message = (err as Error)?.message || 'unknown error';
        const kind = isAlreadyMemberError(message) ? 'skipped' : 'failed';
        localResults.push({ email, kind, message });
      }
      setProgress(i + 1);
    }

    setResults(localResults);
    setPhase('done');
    queryClient?.invalidateQueries({ queryKey: ['classroom', 'students', courseId] });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={phase === 'running' ? '[&>button]:hidden max-w-2xl' : 'max-w-2xl'}>
        {phase === 'select' && (
          <>
            <DialogHeader>
              <DialogTitle>학급 일괄 초대</DialogTitle>
              <DialogDescription>
                <span className="font-mono">{courseName || courseId}</span> 코스에 학급 학생들을 일괄 초대합니다.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-2">
              <div className="flex items-center gap-2">
                <label htmlFor="bulk-invite-year-input" className="text-small text-fg-secondary">
                  연도:
                </label>
                <input
                  id="bulk-invite-year-input"
                  type="number"
                  min={1900}
                  max={2200}
                  value={yearInput}
                  onChange={(e) => handleYearChange(e.target.value)}
                  data-testid="bulk-invite-year-input"
                  className="w-24 border border-border-subtle bg-canvas px-2 py-1 text-body font-mono text-fg-primary text-center focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
                />
              </div>

              {basicDataQuery.isLoading && (
                <div className="py-6 text-center text-small text-fg-secondary" data-testid="bulk-invite-loading">
                  기초 데이터 로딩 중...
                </div>
              )}

              {basicDataQuery.isError && (
                <div className="border border-state-danger p-3 text-small text-state-danger" data-testid="bulk-invite-error">
                  오류: {basicDataQuery.error?.message || '기초 데이터를 불러올 수 없습니다.'}
                </div>
              )}

              {!basicDataQuery.isLoading && !basicDataQuery.isError && grades.length === 0 && (
                <p className="text-small text-fg-muted py-4 text-center">
                  {selectedYear}년도 학년/반 정보가 없습니다.
                </p>
              )}

              {!basicDataQuery.isLoading && !basicDataQuery.isError && grades.length > 0 && (
                <div className="space-y-3">
                  <div className="text-small font-medium text-fg-primary">학년 및 반 선택:</div>
                  <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                    {grades.map((g) => (
                      <div key={g.grade} className="border border-border-subtle p-2 space-y-2">
                        <div className="text-small font-semibold text-fg-secondary">{g.grade}학년</div>
                        <div className="flex flex-wrap gap-2">
                          {g.classes.map((c) => {
                            const isSelected = selectedGrade === g.grade && selectedClass === c;
                            return (
                              <Button
                                key={c}
                                type="button"
                                variant={isSelected ? 'default' : 'secondary'}
                                size="sm"
                                onClick={() => {
                                  setSelectedGrade(g.grade);
                                  setSelectedClass(c);
                                }}
                                data-testid={`bulk-invite-class-btn-${g.grade}-${c}`}
                              >
                                {c}반
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedGrade !== null && selectedClass !== null && (
                <div className="space-y-2" data-testid="bulk-invite-preview">
                  <div className="text-small font-medium text-fg-primary">
                    선택: <span className="font-semibold">{selectedGrade}학년 {selectedClass}반</span> (학생 {targets.length}명)
                  </div>
                  <div className="max-h-36 overflow-y-auto border border-border-subtle">
                    {targets.length === 0 ? (
                      <div className="p-3 text-small text-fg-muted text-center">
                        해당 반에 등록된 학생 이메일이 없습니다.
                      </div>
                    ) : (
                      <ul className="divide-y divide-border-subtle text-small">
                        {targets.map((email, idx) => (
                          <li key={`${email}-${idx}`} className="px-3 py-1 font-mono text-fg-primary">
                            {email}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                취소
              </Button>
              <Button
                data-testid="bulk-invite-preview-btn"
                disabled={selectedGrade === null || selectedClass === null || targets.length === 0}
                onClick={() => setPhase('preview')}
              >
                미리보기
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === 'preview' && (
          <>
            <DialogHeader>
              <DialogTitle>초대 대상 확인</DialogTitle>
              <DialogDescription>
                <span className="font-mono">{courseName || courseId}</span> 코스에 {selectedGrade}학년 {selectedClass}반 학생 {targets.length}명을 초대합니다.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-2">
              <div className="space-y-2" data-testid="bulk-invite-preview">
                <div className="flex justify-between text-small text-fg-secondary">
                  <span>{selectedGrade}학년 {selectedClass}반 학생 명단</span>
                  <span className="font-medium text-fg-primary">{targets.length}명</span>
                </div>
                <div className="max-h-48 overflow-y-auto border border-border-subtle">
                  <ul className="divide-y divide-border-subtle text-small">
                    {targets.map((email, idx) => (
                      <li key={`${email}-${idx}`} className="px-3 py-1.5 font-mono text-fg-primary">
                        {email}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="bulk-invite-confirm-input" className="text-small text-fg-primary block">
                  확인을 위해 대상 학생 수 (<strong>{targets.length}</strong>)를 입력하세요:
                </label>
                <input
                  id="bulk-invite-confirm-input"
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={String(targets.length)}
                  data-testid="bulk-invite-confirm-input"
                  className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="secondary" onClick={() => setPhase('select')}>
                이전
              </Button>
              <Button
                onClick={handleExecute}
                disabled={
                  targets.length === 0 ||
                  confirmText.trim() !== String(targets.length)
                }
                data-testid="bulk-invite-execute-btn"
              >
                초대 실행
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === 'running' && (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>학생 초대 진행 중</DialogTitle>
              <DialogDescription>학생들을 코스에 순차적으로 초대하고 있습니다.</DialogDescription>
            </DialogHeader>
            <div className="py-8 text-center space-y-3" data-testid="bulk-invite-running">
              <div className="text-body text-fg-primary">
                초대 진행 중: <strong className="font-mono">{progress}</strong> /{' '}
                <strong className="font-mono">{targets.length}</strong>
              </div>
              <div className="w-full bg-canvas h-2 border border-border-subtle">
                <div
                  className="bg-fg-primary h-full transition-all"
                  style={{
                    width: `${targets.length > 0 ? (progress / targets.length) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </>
        )}

        {phase === 'done' && (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>학생 초대 완료</DialogTitle>
              <DialogDescription>학급 일괄 초대 작업이 완료되었습니다.</DialogDescription>
            </DialogHeader>
            <div data-testid="bulk-invite-done" className="space-y-3">
              {(() => {
                const okCount = results.filter((r) => r.kind === 'ok').length;
                const skippedCount = results.filter((r) => r.kind === 'skipped').length;
                const failedCount = results.filter((r) => r.kind === 'failed').length;
                return (
                  <p className="text-body text-fg-primary">
                    완료:{' '}
                    <strong className="text-state-success font-mono">{okCount}</strong>명 성공
                    {skippedCount > 0 && (
                      <>
                        {' '}
                        · <strong className="text-state-warning font-mono">{skippedCount}</strong>명 이미 멤버 (skip)
                      </>
                    )}
                    {failedCount > 0 && (
                      <>
                        {' '}
                        · <strong className="text-state-danger font-mono">{failedCount}</strong>명 실패
                      </>
                    )}
                  </p>
                );
              })()}
              {results.some((r) => r.kind === 'skipped') && (
                <ul
                  className="text-small text-state-warning space-y-1 max-h-40 overflow-y-auto"
                  data-testid="bulk-invite-skipped"
                >
                  {results
                    .filter((r) => r.kind === 'skipped')
                    .map((r, i) => (
                      <li key={`${r.email}-${i}`}>
                        <span className="font-mono">{r.email}</span>: 이미 멤버
                      </li>
                    ))}
                </ul>
              )}
              {results.some((r) => r.kind === 'failed') && (
                <ul
                  className="text-small text-state-danger space-y-1 max-h-40 overflow-y-auto"
                  data-testid="bulk-invite-failures"
                >
                  {results
                    .filter((r) => r.kind === 'failed')
                    .map((r, i) => (
                      <li key={`${r.email}-${i}`}>
                        <span className="font-mono">{r.email}</span>: {r.message}
                      </li>
                    ))}
                </ul>
              )}
              <DialogFooter>
                <Button
                  onClick={() => {
                    onOpenChange(false);
                    onDone?.();
                  }}
                >
                  확인
                </Button>
              </DialogFooter>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ClassroomBulkInviteDialog(props: ClassroomBulkInviteDialogProps) {
  if (!props.open) return null;
  return <ClassroomBulkInviteDialogContent {...props} />;
}
