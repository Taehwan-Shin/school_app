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
import { callClassroomCreate } from '../../api/classroomCreate';
import { callClassroomList } from '../../api/classroomList';

export interface CourseBulkCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}

export type Phase = 'select' | 'preview' | 'running' | 'done';
export type ResultKind = 'ok' | 'skipped' | 'failed';

export interface BatchCreateResult {
  gradeClass: string;
  courseName: string;
  kind: ResultKind;
  courseId?: string;
  message?: string;
}

export function isYearValid(val: string): boolean {
  const trimmed = val.trim();
  if (trimmed === '' || !/^\d+$/.test(trimmed)) return false;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) && parsed >= 1900 && parsed <= 2200;
}

export function courseName(year: number, grade: number, cls: string): string {
  return `${year}학년도 ${grade}학년 ${cls}반`;
}

export function isAlreadyExistsError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('already') ||
    lower.includes('duplicate') ||
    lower.includes('exists') ||
    lower.includes('409')
  );
}

export function keyOf(grade: number, cls: string): string {
  return `${grade}\0${cls}`;
}

export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true });
}

// FNV-1a 64-bit → 16자 hex. 서버 ID_RE (`d:[A-Za-z0-9._@:\-]{1,100}`) 안전 문자만.
// basicData 는 반 이름에 한국어·특수문자·공백을 허용하므로 원본 문자열을 그대로
// alias 에 넣으면 서버 검증에서 invalid_id 로 실패한다 (v0.95 Codex F6). 결정적
// hash 로 인코딩해 alias 생성.
export function hashSlug(input: string): string {
  const PRIME = 0x100000001b3n;
  const OFFSET = 0xcbf29ce484222325n;
  const MASK = 0xffffffffffffffffn;
  let h = OFFSET;
  const bytes = new TextEncoder().encode(input);
  for (const b of bytes) {
    h ^= BigInt(b);
    h = (h * PRIME) & MASK;
  }
  return h.toString(16).padStart(16, '0');
}

// (year, grade, cls) 전체를 hash payload 에 넣어 alias 생성. 기존 (year·grade 를
// 그대로 삽입) 방식은 `1e21` 같은 값에서 JS 가 `1e+21` 로 string 변환하며 서버
// ID_RE 의 금지 문자 `+` 를 유발했다 (v0.96 Codex F9). 전체 tuple 을 hash 하면
// grade·year 도 hex slug 안에 흡수돼 결과 alias 는 항상 `d:<16 hex>` 형태다.
export function aliasFor(year: number, grade: number, cls: string): string {
  return `d:${hashSlug(`${year}:${grade}:${cls}`)}`;
}

function CourseBulkCreateDialogContent({
  open,
  onOpenChange,
  onDone,
}: CourseBulkCreateDialogProps) {
  const queryClient = useContext(QueryClientContext);
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [yearInput, setYearInput] = useState(String(thisYear));
  const [selected, setSelected] = useState<Map<string, { grade: number; cls: string }>>(new Map());
  const [ownerId, setOwnerId] = useState('me');
  const [courseState, setCourseState] = useState<'PROVISIONED' | 'ACTIVE'>('PROVISIONED');
  const [confirmText, setConfirmText] = useState('');
  const [phase, setPhase] = useState<Phase>('select');
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<BatchCreateResult[]>([]);

  const basicDataQuery = useBasicDataGet(year, open);
  const grades = basicDataQuery.data?.data?.grades ?? [];

  useEffect(() => {
    if (open) {
      setPhase('select');
      setSelected(new Map());
      setConfirmText('');
      setProgress(0);
      setResults([]);
      setOwnerId('me');
      setCourseState('PROVISIONED');
    }
  }, [open]);

  const handleOpenChange = (next: boolean) => {
    if (phase === 'running') return;
    onOpenChange(next);
  };

  const handleYearChange = (val: string) => {
    setYearInput(val);
    setSelected(new Map());
    if (isYearValid(val)) {
      setYear(Number.parseInt(val.trim(), 10));
    }
  };

  const toggleClass = (grade: number, cls: string) => {
    const key = keyOf(grade, cls);
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.set(key, { grade, cls });
      }
      return next;
    });
  };

  const handleSelectAllGrade = (grade: number, classes: string[]) => {
    setSelected((prev) => {
      const next = new Map(prev);
      for (const c of classes) {
        next.set(keyOf(grade, c), { grade, cls: c });
      }
      return next;
    });
  };

  const handleDeselectAllGrade = (grade: number, classes: string[]) => {
    setSelected((prev) => {
      const next = new Map(prev);
      for (const c of classes) {
        next.delete(keyOf(grade, c));
      }
      return next;
    });
  };

  const selectedItems = useMemo(() => {
    if (!isYearValid(yearInput)) return [];
    return Array.from(selected.values())
      .map((item) => ({
        grade: item.grade,
        cls: item.cls,
        key: `${item.grade}-${item.cls}`,
        name: courseName(year, item.grade, item.cls),
      }))
      .sort((a, b) => a.grade - b.grade || naturalCompare(a.cls, b.cls));
  }, [selected, year, yearInput]);

  const handleExecute = async () => {
    if (selectedItems.length === 0 || confirmText.trim() !== String(selectedItems.length)) return;
    setPhase('running');
    setProgress(0);
    const localResults: BatchCreateResult[] = [];

    // v0.91 이전에 alias 없이 만든 코스는 새 alias-scoped create 로는 감지되지 않아
    // 재실행 시 중복이 만들어진다 (v0.96 Codex F8). 사전에 사용자가 접근 가능한
    // 코스 목록을 한 번 조회해 (name, section) 로 legacy skip 을 확정한다.
    const legacyKeys = new Set<string>();
    try {
      const list = await callClassroomList();
      for (const c of list.courses ?? []) {
        if (typeof c.name === 'string' && typeof c.section === 'string') {
          legacyKeys.add(`${c.name}${c.section}`);
        }
      }
    } catch {
      // list 실패는 fatal 이 아니라 legacy skip 만 포기 (Google alias 충돌은 서버 layer 가 잡음).
    }

    for (let i = 0; i < selectedItems.length; i++) {
      const item = selectedItems[i];
      const section = `${item.grade}-${item.cls}`;
      const name = item.name;
      const id = aliasFor(year, item.grade, item.cls);

      if (legacyKeys.has(`${name}${section}`)) {
        localResults.push({
          gradeClass: section,
          courseName: name,
          kind: 'skipped',
          message: 'legacy_duplicate',
        });
        setProgress(i + 1);
        continue;
      }

      try {
        const res = await callClassroomCreate({
          id,
          name,
          section,
          ownerId: ownerId.trim() || 'me',
          courseState,
        });
        localResults.push({
          gradeClass: section,
          courseName: name,
          kind: 'ok',
          courseId: res.course?.id,
        });
      } catch (err) {
        const message = (err as Error)?.message || 'unknown error';
        const kind: ResultKind = isAlreadyExistsError(message) ? 'skipped' : 'failed';
        localResults.push({
          gradeClass: section,
          courseName: name,
          kind,
          message,
        });
      }
      setProgress(i + 1);
    }

    setResults(localResults);
    setPhase('done');
    queryClient?.invalidateQueries({ queryKey: ['classroom', 'list'] });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={phase === 'running' ? '[&>button]:hidden max-w-2xl' : 'max-w-2xl'}
        onPointerDownOutside={(e) => {
          if (phase === 'running') e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (phase === 'running') e.preventDefault();
        }}
      >
        {phase === 'select' && (
          <>
            <DialogHeader>
              <DialogTitle>학년/반 코스 일괄 생성</DialogTitle>
              <DialogDescription>
                기초 데이터를 바탕으로 학년과 반별 Google Classroom 코스를 일괄 생성합니다.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-2">
              <div className="flex items-center gap-2">
                <label htmlFor="bulk-create-year-input" className="text-small text-fg-secondary">
                  연도:
                </label>
                <input
                  id="bulk-create-year-input"
                  type="number"
                  min={1900}
                  max={2200}
                  value={yearInput}
                  onChange={(e) => handleYearChange(e.target.value)}
                  data-testid="bulk-create-year-input"
                  className="w-24 border border-border-subtle bg-canvas px-2 py-1 text-body font-mono text-fg-primary text-center focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
                />
              </div>

              {basicDataQuery.isLoading && (
                <div className="py-6 text-center text-small text-fg-secondary" data-testid="bulk-create-loading">
                  기초 데이터 로딩 중...
                </div>
              )}

              {basicDataQuery.isError && (
                <div className="border border-state-danger p-3 text-small text-state-danger" data-testid="bulk-create-error">
                  오류: {basicDataQuery.error?.message || '기초 데이터를 불러올 수 없습니다.'}
                </div>
              )}

              {!basicDataQuery.isLoading && !basicDataQuery.isError && grades.length === 0 && (
                <p className="text-small text-fg-muted py-4 text-center">
                  {isYearValid(yearInput) ? `${year}년도 학년/반 정보가 없습니다.` : '유효한 연도를 입력해주세요.'}
                </p>
              )}

              {!basicDataQuery.isLoading && !basicDataQuery.isError && grades.length > 0 && (
                <div className="space-y-3">
                  <div className="text-small font-medium text-fg-primary">학년 및 반 선택:</div>
                  <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                    {grades.map((g) => (
                      <div key={g.grade} className="border border-border-subtle p-2 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-small font-semibold text-fg-secondary">{g.grade}학년</span>
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSelectAllGrade(g.grade, g.classes)}
                              data-testid={`bulk-create-select-all-${g.grade}`}
                              className="text-xs h-7 px-2"
                            >
                              전체 선택
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeselectAllGrade(g.grade, g.classes)}
                              data-testid={`bulk-create-deselect-all-${g.grade}`}
                              className="text-xs h-7 px-2"
                            >
                              전체 해제
                            </Button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {g.classes.map((c) => (
                            <label
                              key={c}
                              className="flex items-center gap-1.5 cursor-pointer text-small px-2 py-1 border border-border-subtle bg-canvas hover:bg-canvas-subtle select-none"
                            >
                              <input
                                type="checkbox"
                                checked={selected.has(keyOf(g.grade, c))}
                                onChange={() => toggleClass(g.grade, c)}
                                data-testid={`bulk-create-class-cb-${g.grade}-${c}`}
                                className="accent-fg-primary cursor-pointer"
                              />
                              <span>{c}반</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border-subtle">
                <div>
                  <label htmlFor="bulk-create-owner" className="text-small text-fg-secondary mb-1 block">
                    소유자 (ownerId)
                  </label>
                  <input
                    id="bulk-create-owner"
                    type="text"
                    value={ownerId}
                    onChange={(e) => setOwnerId(e.target.value)}
                    placeholder="me"
                    data-testid="bulk-create-owner"
                    className="w-full border border-border-subtle bg-canvas px-3 py-1.5 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
                  />
                </div>
                <div>
                  <label htmlFor="bulk-create-state" className="text-small text-fg-secondary mb-1 block">
                    상태 (courseState)
                  </label>
                  <select
                    id="bulk-create-state"
                    value={courseState}
                    onChange={(e) => setCourseState(e.target.value as 'PROVISIONED' | 'ACTIVE')}
                    data-testid="bulk-create-state"
                    className="w-full border border-border-subtle bg-canvas px-3 py-1.5 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
                  >
                    <option value="PROVISIONED">PROVISIONED</option>
                    <option value="ACTIVE">ACTIVE</option>
                  </select>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                취소
              </Button>
              <Button
                data-testid="bulk-create-preview-btn"
                disabled={!isYearValid(yearInput) || selected.size === 0}
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
              <DialogTitle>일괄 생성 대상 확인</DialogTitle>
              <DialogDescription>
                {year}학년도 {selectedItems.length}개 반의 클래스룸 코스를 생성합니다.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-2">
              <div className="space-y-2">
                <div className="flex justify-between text-small text-fg-secondary">
                  <span>생성 대상 코스 목록</span>
                  <span className="font-medium text-fg-primary">총 {selectedItems.length}개 코스</span>
                </div>
                <div
                  className="max-h-48 overflow-y-auto border border-border-subtle"
                  data-testid="bulk-create-preview"
                >
                  <ul className="divide-y divide-border-subtle text-small">
                    {selectedItems.map((item) => (
                      <li key={item.key} className="px-3 py-1.5 flex justify-between items-center text-fg-primary">
                        <span className="font-mono text-fg-secondary text-xs">{item.key}</span>
                        <span className="font-medium">{item.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="bulk-create-confirm-input" className="text-small text-fg-primary block">
                  확인을 위해 생성할 코스 수 (<strong>{selectedItems.length}</strong>)를 입력하세요:
                </label>
                <input
                  id="bulk-create-confirm-input"
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={String(selectedItems.length)}
                  data-testid="bulk-create-confirm-input"
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
                  selectedItems.length === 0 ||
                  confirmText.trim() !== String(selectedItems.length)
                }
                data-testid="bulk-create-execute-btn"
              >
                생성 실행
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === 'running' && (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>코스 일괄 생성 진행 중</DialogTitle>
              <DialogDescription>코스를 순차적으로 생성하고 있습니다.</DialogDescription>
            </DialogHeader>
            <div className="py-8 text-center space-y-3" data-testid="bulk-create-running">
              <div className="text-body text-fg-primary">
                코스 생성 진행 중: <strong className="font-mono">{progress}</strong> /{' '}
                <strong className="font-mono">{selectedItems.length}</strong>
              </div>
              <div className="w-full bg-canvas h-2 border border-border-subtle">
                <div
                  className="bg-fg-primary h-full transition-all"
                  style={{
                    width: `${selectedItems.length > 0 ? (progress / selectedItems.length) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </>
        )}

        {phase === 'done' && (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>코스 일괄 생성 완료</DialogTitle>
              <DialogDescription>코스 일괄 생성 작업이 완료되었습니다.</DialogDescription>
            </DialogHeader>
            <div data-testid="bulk-create-done" className="space-y-3">
              {(() => {
                const okCount = results.filter((r) => r.kind === 'ok').length;
                const skippedCount = results.filter((r) => r.kind === 'skipped').length;
                const failedCount = results.filter((r) => r.kind === 'failed').length;
                return (
                  <p className="text-body text-fg-primary">
                    완료:{' '}
                    <strong className="text-state-success font-mono">{okCount}</strong>개 생성
                    {skippedCount > 0 && (
                      <>
                        {' '}
                        · <strong className="text-state-warning font-mono">{skippedCount}</strong>개 이미 존재 (skip)
                      </>
                    )}
                    {failedCount > 0 && (
                      <>
                        {' '}
                        · <strong className="text-state-danger font-mono">{failedCount}</strong>개 실패
                      </>
                    )}
                  </p>
                );
              })()}
              {results.some((r) => r.kind === 'skipped') && (
                <ul
                  className="text-small text-state-warning space-y-1 max-h-40 overflow-y-auto"
                  data-testid="bulk-create-skipped"
                >
                  {results
                    .filter((r) => r.kind === 'skipped')
                    .map((r, i) => (
                      <li key={`${r.gradeClass}-${i}`}>
                        <span className="font-mono">{r.courseName}</span>: 이미 존재 ({r.message || 'skip'})
                      </li>
                    ))}
                </ul>
              )}
              {results.some((r) => r.kind === 'failed') && (
                <ul
                  className="text-small text-state-danger space-y-1 max-h-40 overflow-y-auto"
                  data-testid="bulk-create-failures"
                >
                  {results
                    .filter((r) => r.kind === 'failed')
                    .map((r, i) => (
                      <li key={`${r.gradeClass}-${i}`}>
                        <span className="font-mono">{r.courseName}</span>: {r.message}
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

export function CourseBulkCreateDialog(props: CourseBulkCreateDialogProps) {
  if (!props.open) return null;
  return <CourseBulkCreateDialogContent {...props} />;
}
