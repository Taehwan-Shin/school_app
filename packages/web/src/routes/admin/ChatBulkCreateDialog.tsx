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
import { callChatCreate } from '../../api/chatCreate';
import { callChatList } from '../../api/chatList';
import {
  courseName,
  isYearValid,
  isAlreadyExistsError,
  keyOf,
  naturalCompare,
  type Phase,
  type ResultKind,
} from './CourseBulkCreateDialog';

export interface ChatBulkCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}

export interface ChatBatchCreateResult {
  gradeClass: string;
  displayName: string;
  kind: ResultKind;
  spaceName?: string;
  message?: string;
}

function ChatBulkCreateDialogContent({
  open,
  onOpenChange,
  onDone,
}: ChatBulkCreateDialogProps) {
  const queryClient = useContext(QueryClientContext);
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [yearInput, setYearInput] = useState(String(thisYear));
  const [selected, setSelected] = useState<Map<string, { grade: number; cls: string }>>(new Map());
  const [confirmText, setConfirmText] = useState('');
  const [phase, setPhase] = useState<Phase>('select');
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ChatBatchCreateResult[]>([]);

  const basicDataQuery = useBasicDataGet(year, open);
  const grades = basicDataQuery.data?.data?.grades ?? [];

  useEffect(() => {
    if (open) {
      setPhase('select');
      setSelected(new Map());
      setConfirmText('');
      setProgress(0);
      setResults([]);
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
      }))
      .sort((a, b) => a.grade - b.grade || naturalCompare(a.cls, b.cls));
  }, [selected, year, yearInput]);

  const handleExecute = async () => {
    if (selectedItems.length === 0 || confirmText.trim() !== String(selectedItems.length)) return;
    setPhase('running');
    setProgress(0);
    const localResults: ChatBatchCreateResult[] = [];

    // 사전 callChatList 로 사용자 접근 가능한 스페이스 displayName 을 모아 skip 판정.
    // Google Chat spaces.create 는 조직 내 동일 displayName 에 ALREADY_EXISTS 를 반환하므로
    // 서버 layer 가 최종 fallback 이지만, client 사전 대조로 UX 개선 + 불필요한 API 호출 절감.
    // list 실패는 fail-closed (v0.96 F10 패턴) — 사전 대조가 무의미해지는 상태에서는
    // create 를 실행하지 않는다.
    const legacyKeys = new Set<string>();
    try {
      const list = await callChatList();
      for (const s of list.spaces ?? []) {
        if (typeof s.displayName === 'string' && s.displayName.trim().length > 0) {
          legacyKeys.add(JSON.stringify([s.displayName]));
        }
      }
    } catch (err) {
      const message = (err as Error)?.message || 'legacy_list_failed';
      const localFail: ChatBatchCreateResult[] = selectedItems.map((item) => ({
        gradeClass: `${item.grade}-${item.cls}`,
        displayName: item.displayName,
        kind: 'failed' as ResultKind,
        message: `legacy_list_failed: ${message}`,
      }));
      setResults(localFail);
      setProgress(selectedItems.length);
      setPhase('done');
      return;
    }

    for (let i = 0; i < selectedItems.length; i++) {
      const item = selectedItems[i];
      const gradeClass = `${item.grade}-${item.cls}`;
      const displayName = item.displayName;

      if (legacyKeys.has(JSON.stringify([displayName]))) {
        localResults.push({
          gradeClass,
          displayName,
          kind: 'skipped',
          message: 'legacy_duplicate',
        });
        setProgress(i + 1);
        continue;
      }

      // Google Chat spaces.create displayName 128자 제한. basicData 는 반 이름 길이
      // 제약 없으므로 courseName prefix 붙으면 초과 가능 (v0.97 Codex F12). client 층에서
      // 사전 컷하여 사용자에게 즉시 이유 표시.
      if (displayName.length > 128) {
        localResults.push({
          gradeClass,
          displayName,
          kind: 'failed',
          message: `display_name_too_long: ${displayName.length}/128`,
        });
        setProgress(i + 1);
        continue;
      }

      try {
        const res = await callChatCreate({ displayName });
        localResults.push({
          gradeClass,
          displayName,
          kind: 'ok',
          spaceName: res.space?.name,
        });
      } catch (err) {
        const message = (err as Error)?.message || 'unknown error';
        const kind: ResultKind = isAlreadyExistsError(message) ? 'skipped' : 'failed';
        localResults.push({
          gradeClass,
          displayName,
          kind,
          message,
        });
      }
      setProgress(i + 1);
    }

    setResults(localResults);
    setPhase('done');
    queryClient?.invalidateQueries({ queryKey: ['chat', 'list'] });
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
              <DialogTitle>학년/반 Chat 스페이스 일괄 생성</DialogTitle>
              <DialogDescription>
                기초 데이터를 바탕으로 학년과 반별 Google Chat 스페이스를 일괄 생성합니다.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-2">
              <div className="flex items-center gap-2">
                <label htmlFor="bulk-create-chat-year-input" className="text-small text-fg-secondary">
                  연도:
                </label>
                <input
                  id="bulk-create-chat-year-input"
                  type="number"
                  min={1900}
                  max={2200}
                  value={yearInput}
                  onChange={(e) => handleYearChange(e.target.value)}
                  data-testid="bulk-create-chat-year-input"
                  className="w-24 border border-border-subtle bg-canvas px-2 py-1 text-body font-mono text-fg-primary text-center focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
                />
              </div>

              {basicDataQuery.isLoading && (
                <div className="py-6 text-center text-small text-fg-secondary" data-testid="bulk-create-chat-loading">
                  기초 데이터 로딩 중...
                </div>
              )}

              {basicDataQuery.isError && (
                <div className="border border-state-danger p-3 text-small text-state-danger" data-testid="bulk-create-chat-error">
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
                              data-testid={`bulk-create-chat-select-all-${g.grade}`}
                              className="text-xs h-7 px-2"
                            >
                              전체 선택
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeselectAllGrade(g.grade, g.classes)}
                              data-testid={`bulk-create-chat-deselect-all-${g.grade}`}
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
                                data-testid={`bulk-create-chat-class-cb-${g.grade}-${c}`}
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
            </div>

            <DialogFooter>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                취소
              </Button>
              <Button
                data-testid="bulk-create-chat-preview-btn"
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
                {year}학년도 {selectedItems.length}개 반의 Chat 스페이스를 생성합니다.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-2">
              <div className="space-y-2">
                <div className="flex justify-between text-small text-fg-secondary">
                  <span>생성 대상 스페이스 목록</span>
                  <span className="font-medium text-fg-primary">총 {selectedItems.length}개 스페이스</span>
                </div>
                <div
                  className="max-h-48 overflow-y-auto border border-border-subtle"
                  data-testid="bulk-create-chat-preview"
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
                <label htmlFor="bulk-create-chat-confirm-input" className="text-small text-fg-primary block">
                  확인을 위해 생성할 스페이스 수 (<strong>{selectedItems.length}</strong>)를 입력하세요:
                </label>
                <input
                  id="bulk-create-chat-confirm-input"
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={String(selectedItems.length)}
                  data-testid="bulk-create-chat-confirm-input"
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
                data-testid="bulk-create-chat-execute-btn"
              >
                생성 실행
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === 'running' && (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>Chat 스페이스 일괄 생성 진행 중</DialogTitle>
              <DialogDescription>스페이스를 순차적으로 생성하고 있습니다.</DialogDescription>
            </DialogHeader>
            <div className="py-8 text-center space-y-3" data-testid="bulk-create-chat-running">
              <div className="text-body text-fg-primary">
                스페이스 생성 진행 중: <strong className="font-mono">{progress}</strong> /{' '}
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
              <DialogTitle>Chat 스페이스 일괄 생성 완료</DialogTitle>
              <DialogDescription>Chat 스페이스 일괄 생성 작업이 완료되었습니다.</DialogDescription>
            </DialogHeader>
            <div data-testid="bulk-create-chat-done" className="space-y-3">
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
                  data-testid="bulk-create-chat-skipped"
                >
                  {results
                    .filter((r) => r.kind === 'skipped')
                    .map((r, i) => (
                      <li key={`${r.gradeClass}-${i}`}>
                        <span className="font-mono">{r.displayName}</span>: 이미 존재 ({r.message || 'skip'})
                      </li>
                    ))}
                </ul>
              )}
              {results.some((r) => r.kind === 'failed') && (
                <ul
                  className="text-small text-state-danger space-y-1 max-h-40 overflow-y-auto"
                  data-testid="bulk-create-chat-failures"
                >
                  {results
                    .filter((r) => r.kind === 'failed')
                    .map((r, i) => (
                      <li key={`${r.gradeClass}-${i}`}>
                        <span className="font-mono">{r.displayName}</span>: {r.message}
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

export function ChatBulkCreateDialog(props: ChatBulkCreateDialogProps) {
  if (!props.open) return null;
  return <ChatBulkCreateDialogContent {...props} />;
}
