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
import { callChatCreate } from '../../api/chatCreate';
import { callChatList } from '../../api/chatList';
import {
  courseName,
  isYearValid,
  isAlreadyExistsError,
  keyOf,
  naturalCompare,
  aliasFor,
  type Phase,
  type ResultKind,
} from './CourseBulkCreateDialog';

export interface ClassroomChatPairBulkCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}

// pair 결과. course 가 실패하면 chat 은 시도조차 하지 않는다 (`not_attempted`).
export type PairChildKind = ResultKind | 'not_attempted';

export interface PairBatchResult {
  gradeClass: string;
  displayName: string;
  courseKind: ResultKind;
  courseId?: string;
  courseMessage?: string;
  chatKind: PairChildKind;
  chatSpaceName?: string;
  chatMessage?: string;
}

const CHAT_DISPLAY_NAME_MAX = 128;

function ClassroomChatPairBulkCreateDialogContent({
  open,
  onOpenChange,
  onDone,
}: ClassroomChatPairBulkCreateDialogProps) {
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
  const [results, setResults] = useState<PairBatchResult[]>([]);

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
        displayName: courseName(year, item.grade, item.cls),
        section: `${item.grade}-${item.cls}`,
      }))
      .sort((a, b) => a.grade - b.grade || naturalCompare(a.cls, b.cls));
  }, [selected, year, yearInput]);

  const handleExecute = async () => {
    if (selectedItems.length === 0 || confirmText.trim() !== String(selectedItems.length)) return;
    setPhase('running');
    setProgress(0);
    const localResults: PairBatchResult[] = [];

    // 두 도메인 legacy 사전 조회. Classroom 은 alias 로 서버가 ALREADY_EXISTS 를
    // 돌리지만 v0.91 이전 코스는 alias 없이 만들어져 서버 방어가 안 통함 (v0.96 F8).
    // Chat 은 사전 대조가 UX + API 절감 목적 (v0.97 F12 comment 정정).
    // 둘 중 한 쪽이라도 실패하면 fail-closed — legacy 방어가 무의미해지는 상태에서
    // pair 를 실행하면 duplicate 생성 위험.
    const legacyCourseKeys = new Set<string>();
    const legacyChatKeys = new Set<string>();
    try {
      const [courseList, chatList] = await Promise.all([callClassroomList(), callChatList()]);
      for (const c of courseList.courses ?? []) {
        if (typeof c.name === 'string' && typeof c.section === 'string') {
          legacyCourseKeys.add(JSON.stringify([c.name, c.section]));
        }
      }
      for (const s of chatList.spaces ?? []) {
        if (typeof s.displayName === 'string' && s.displayName.trim().length > 0) {
          legacyChatKeys.add(JSON.stringify([s.displayName]));
        }
      }
    } catch (err) {
      const message = (err as Error)?.message || 'legacy_list_failed';
      const localFail: PairBatchResult[] = selectedItems.map((item) => ({
        gradeClass: item.section,
        displayName: item.displayName,
        courseKind: 'failed',
        courseMessage: `legacy_list_failed: ${message}`,
        chatKind: 'not_attempted',
      }));
      setResults(localFail);
      setProgress(selectedItems.length);
      setPhase('done');
      return;
    }

    for (let i = 0; i < selectedItems.length; i++) {
      const item = selectedItems[i];
      const gradeClass = item.section;
      const displayName = item.displayName;
      const section = item.section;
      const id = aliasFor(year, item.grade, item.cls);

      let courseKind: ResultKind;
      let courseId: string | undefined;
      let courseMessage: string | undefined;
      let chatKind: PairChildKind = 'not_attempted';
      let chatSpaceName: string | undefined;
      let chatMessage: string | undefined;

      // 0. pair 사전 검증 — chat 이 확정적으로 실패할 걸 알면 course 도 만들지 않는다.
      // Google Chat displayName 128자 제한 (v0.97 F12) 이 확정 실패라 통합 다이얼로그에서
      // course 만 만들면 orphan 이 남는다 (v0.98 Codex F13). pair 전체 skip.
      if (displayName.length > CHAT_DISPLAY_NAME_MAX) {
        localResults.push({
          gradeClass,
          displayName,
          courseKind: 'failed',
          courseMessage: `pair_precheck_failed: display_name_too_long: ${displayName.length}/${CHAT_DISPLAY_NAME_MAX}`,
          chatKind: 'not_attempted',
        });
        setProgress(i + 1);
        continue;
      }

      // 1. course
      if (legacyCourseKeys.has(JSON.stringify([displayName, section]))) {
        courseKind = 'skipped';
        courseMessage = 'legacy_duplicate';
      } else {
        try {
          const res = await callClassroomCreate({
            id,
            name: displayName,
            section,
            ownerId: ownerId.trim() || 'me',
            courseState,
          });
          courseKind = 'ok';
          courseId = res.course?.id;
        } catch (err) {
          const message = (err as Error)?.message || 'unknown error';
          courseKind = isAlreadyExistsError(message) ? 'skipped' : 'failed';
          courseMessage = message;
        }
      }

      // 2. chat — course 가 실패하면 시도하지 않는다.
      if (courseKind !== 'failed') {
        if (legacyChatKeys.has(JSON.stringify([displayName]))) {
          chatKind = 'skipped';
          chatMessage = 'legacy_duplicate';
        } else {
          try {
            const res = await callChatCreate({ displayName });
            chatKind = 'ok';
            chatSpaceName = res.space?.name;
          } catch (err) {
            const message = (err as Error)?.message || 'unknown error';
            chatKind = isAlreadyExistsError(message) ? 'skipped' : 'failed';
            chatMessage = message;
          }
        }
      }

      localResults.push({
        gradeClass,
        displayName,
        courseKind,
        courseId,
        courseMessage,
        chatKind,
        chatSpaceName,
        chatMessage,
      });
      setProgress(i + 1);
    }

    setResults(localResults);
    setPhase('done');
    queryClient?.invalidateQueries({ queryKey: ['classroom', 'list'] });
    queryClient?.invalidateQueries({ queryKey: ['chat', 'list'] });
  };

  const total = selectedItems.length;

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
              <DialogTitle>학급 통합 생성 (Classroom + Chat)</DialogTitle>
              <DialogDescription>
                선택한 학년/반에 대해 Classroom 코스와 Chat 스페이스를 함께 생성합니다.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-2">
              <div className="flex items-center gap-2">
                <label htmlFor="pair-year-input" className="text-small text-fg-secondary">
                  연도:
                </label>
                <input
                  id="pair-year-input"
                  type="number"
                  min={1900}
                  max={2200}
                  value={yearInput}
                  onChange={(e) => handleYearChange(e.target.value)}
                  data-testid="pair-year-input"
                  className="w-24 border border-border-subtle bg-canvas px-2 py-1 text-body font-mono text-fg-primary text-center focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
                />
              </div>

              {basicDataQuery.isLoading && (
                <div className="py-6 text-center text-small text-fg-secondary" data-testid="pair-loading">
                  기초 데이터 로딩 중...
                </div>
              )}

              {basicDataQuery.isError && (
                <div className="border border-state-danger p-3 text-small text-state-danger" data-testid="pair-error">
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
                              data-testid={`pair-select-all-${g.grade}`}
                              className="text-xs h-7 px-2"
                            >
                              전체 선택
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeselectAllGrade(g.grade, g.classes)}
                              data-testid={`pair-deselect-all-${g.grade}`}
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
                                data-testid={`pair-class-cb-${g.grade}-${c}`}
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
                  <label htmlFor="pair-owner" className="text-small text-fg-secondary mb-1 block">
                    소유자 (ownerId, Classroom)
                  </label>
                  <input
                    id="pair-owner"
                    type="text"
                    value={ownerId}
                    onChange={(e) => setOwnerId(e.target.value)}
                    placeholder="me"
                    data-testid="pair-owner"
                    className="w-full border border-border-subtle bg-canvas px-3 py-1.5 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
                  />
                </div>
                <div>
                  <label htmlFor="pair-state" className="text-small text-fg-secondary mb-1 block">
                    상태 (courseState)
                  </label>
                  <select
                    id="pair-state"
                    value={courseState}
                    onChange={(e) => setCourseState(e.target.value as 'PROVISIONED' | 'ACTIVE')}
                    data-testid="pair-state"
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
                data-testid="pair-preview-btn"
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
              <DialogTitle>학급 통합 생성 대상 확인</DialogTitle>
              <DialogDescription>
                {year}학년도 {total}개 학급의 Classroom 코스와 Chat 스페이스를 각각 생성합니다.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-2">
              <div className="space-y-2">
                <div className="flex justify-between text-small text-fg-secondary">
                  <span>생성 대상 학급 목록</span>
                  <span className="font-medium text-fg-primary">총 {total}개 학급 (course + space {total * 2}개)</span>
                </div>
                <div
                  className="max-h-48 overflow-y-auto border border-border-subtle"
                  data-testid="pair-preview"
                >
                  <ul className="divide-y divide-border-subtle text-small">
                    {selectedItems.map((item) => (
                      <li key={item.key} className="px-3 py-1.5 flex justify-between items-center text-fg-primary">
                        <span className="font-mono text-fg-secondary text-xs">{item.key}</span>
                        <span className="font-medium">{item.displayName}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="pair-confirm-input" className="text-small text-fg-primary block">
                  확인을 위해 생성할 학급 수 (<strong>{total}</strong>)를 입력하세요:
                </label>
                <input
                  id="pair-confirm-input"
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={String(total)}
                  data-testid="pair-confirm-input"
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
                disabled={total === 0 || confirmText.trim() !== String(total)}
                data-testid="pair-execute-btn"
              >
                통합 생성 실행
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === 'running' && (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>학급 통합 생성 진행 중</DialogTitle>
              <DialogDescription>Classroom 과 Chat 을 순차적으로 생성하고 있습니다.</DialogDescription>
            </DialogHeader>
            <div className="py-8 text-center space-y-3" data-testid="pair-running">
              <div className="text-body text-fg-primary">
                학급 처리 진행 중: <strong className="font-mono">{progress}</strong> /{' '}
                <strong className="font-mono">{total}</strong>
              </div>
              <div className="w-full bg-canvas h-2 border border-border-subtle">
                <div
                  className="bg-fg-primary h-full transition-all"
                  style={{
                    width: `${total > 0 ? (progress / total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </>
        )}

        {phase === 'done' && (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>학급 통합 생성 완료</DialogTitle>
              <DialogDescription>Classroom + Chat 통합 생성이 완료되었습니다.</DialogDescription>
            </DialogHeader>
            <div data-testid="pair-done" className="space-y-3">
              {(() => {
                const bothOk = results.filter((r) => r.courseKind === 'ok' && r.chatKind === 'ok').length;
                const partial = results.filter(
                  (r) =>
                    (r.courseKind === 'ok' || r.courseKind === 'skipped') &&
                    (r.chatKind === 'ok' || r.chatKind === 'skipped') &&
                    !(r.courseKind === 'ok' && r.chatKind === 'ok'),
                ).length;
                const failed = results.filter(
                  (r) => r.courseKind === 'failed' || r.chatKind === 'failed',
                ).length;
                return (
                  <p className="text-body text-fg-primary">
                    완료:{' '}
                    <strong className="text-state-success font-mono">{bothOk}</strong>개 course+chat 생성
                    {partial > 0 && (
                      <>
                        {' '}
                        · <strong className="text-state-warning font-mono">{partial}</strong>개 부분 완료/skip
                      </>
                    )}
                    {failed > 0 && (
                      <>
                        {' '}
                        · <strong className="text-state-danger font-mono">{failed}</strong>개 실패
                      </>
                    )}
                  </p>
                );
              })()}
              {results.length > 0 && (
                <ul
                  className="text-small text-fg-primary space-y-1 max-h-60 overflow-y-auto"
                  data-testid="pair-results"
                >
                  {results.map((r, i) => (
                    <li key={`${r.gradeClass}-${i}`} className="border-b border-border-subtle py-1">
                      <span className="font-mono">{r.gradeClass}</span>{' '}
                      <span className="text-fg-secondary">{r.displayName}</span>
                      <div className="text-xs ml-4">
                        <span className={r.courseKind === 'failed' ? 'text-state-danger' : r.courseKind === 'ok' ? 'text-state-success' : 'text-state-warning'}>
                          course: {r.courseKind}
                        </span>
                        {r.courseMessage ? ` (${r.courseMessage})` : ''}
                        {' · '}
                        <span
                          className={
                            r.chatKind === 'failed'
                              ? 'text-state-danger'
                              : r.chatKind === 'ok'
                                ? 'text-state-success'
                                : r.chatKind === 'not_attempted'
                                  ? 'text-fg-muted'
                                  : 'text-state-warning'
                          }
                        >
                          chat: {r.chatKind}
                        </span>
                        {r.chatMessage ? ` (${r.chatMessage})` : ''}
                      </div>
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

export function ClassroomChatPairBulkCreateDialog(props: ClassroomChatPairBulkCreateDialogProps) {
  if (!props.open) return null;
  return <ClassroomChatPairBulkCreateDialogContent {...props} />;
}
