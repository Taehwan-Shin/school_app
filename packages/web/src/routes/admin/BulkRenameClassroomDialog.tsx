import { useState, useEffect, useMemo } from 'react';
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
import { COURSE_NAME_MAX } from '../../lib/classroomLimits';

export interface BulkRenameClassroomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courses: { id: string; name?: string }[];
  onDone?: () => void;
}

type Phase = 'confirm' | 'running' | 'done';

interface CourseRow {
  id: string;
  originalName: string;
  newName: string;
}

// v0.134: 원본 Apps Script `updateAndLogClassroomNames` 포팅. 다중 선택된
// 클래스룸 코스에 대해 찾기/바꾸기 패턴 (선택) + 개별 편집 (필수) 로 새 이름을
// 입력하고 순차 patch. BulkArchive 3-phase 골격 + F99/F100 패턴 (snapshot,
// label htmlFor/id) 재사용.
export function BulkRenameClassroomDialog({
  open,
  onOpenChange,
  courses,
  onDone,
}: BulkRenameClassroomDialogProps) {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>('confirm');
  const [progress, setProgress] = useState(0);
  const [failures, setFailures] = useState<{ id: string; message: string }[]>([]);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [rows, setRows] = useState<CourseRow[]>([]);
  // v0.134 F99 대칭: confirm 시점에 대상 목록을 snapshot 으로 고정. running/done
  // 화면에서 부모의 courses prop 이 list invalidation 결과로 재계산돼도 총량 안정.
  const [snapshot, setSnapshot] = useState<CourseRow[] | null>(null);

  useEffect(() => {
    if (open) {
      setPhase('confirm');
      setProgress(0);
      setFailures([]);
      setFindText('');
      setReplaceText('');
      setSnapshot(null);
      setRows(
        courses.map((c) => ({
          id: c.id,
          originalName: c.name ?? '',
          newName: c.name ?? '',
        })),
      );
    }
    // v0.134: rows 는 open 시점에만 courses 로 초기화. 부모 courses prop 이
    // list invalidation 결과로 재계산돼도 열려있는 다이얼로그의 편집 상태는
    // 유지 (F99 대칭). courses 의존성을 뺀 것은 의도적.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleOpenChange = (newOpen: boolean) => {
    if (phase === 'running') return;
    if (!newOpen && phase === 'done') onDone?.();
    onOpenChange(newOpen);
  };

  // 실제 변경이 발생하는 (originalName !== newName) 행만 patch 대상.
  const changedRows = useMemo(
    () => rows.filter((r) => r.newName.trim() !== r.originalName.trim() && r.newName.trim().length > 0),
    [rows],
  );
  const invalidRows = useMemo(
    () => rows.filter((r) => r.newName.trim().length === 0),
    [rows],
  );
  // v0.176: Google Classroom courses.name 상한 750자. row-level 초과 검증.
  const overlyLongRows = useMemo(
    () => rows.filter((r) => r.newName.length > COURSE_NAME_MAX),
    [rows],
  );

  const activeRows = snapshot ?? changedRows;

  const applyPattern = () => {
    if (findText.length === 0) return;
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        newName: r.originalName.split(findText).join(replaceText),
      })),
    );
  };

  const resetRows = () => {
    setRows((prev) => prev.map((r) => ({ ...r, newName: r.originalName })));
    setFindText('');
    setReplaceText('');
  };

  const updateRowName = (id: string, value: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, newName: value } : r)));
  };

  const handleConfirm = async () => {
    const frozen = changedRows.map((r) => ({
      id: r.id,
      originalName: r.originalName,
      newName: r.newName.trim(),
    }));
    setSnapshot(frozen);
    setPhase('running');
    const localFailures: { id: string; message: string }[] = [];
    for (let i = 0; i < frozen.length; i++) {
      const r = frozen[i];
      try {
        await callClassroomPatch({ id: r.id, name: r.newName });
      } catch (e) {
        localFailures.push({ id: r.id, message: (e as Error).message });
      }
      setProgress(i + 1);
    }
    setFailures(localFailures);
    setPhase('done');
    queryClient.invalidateQueries({ queryKey: ['classroom', 'list'] });
  };

  const canConfirm =
    changedRows.length > 0 &&
    invalidRows.length === 0 &&
    overlyLongRows.length === 0 &&
    phase === 'confirm';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={phase === 'running' ? '[&>button]:hidden' : undefined}>
        {phase === 'confirm' && (
          <>
            <DialogHeader>
              <DialogTitle>클래스룸 일괄 이름 변경</DialogTitle>
              <DialogDescription>
                선택한 {courses.length}개 코스의 이름을 편집합니다. 패턴으로 일괄 적용하거나
                개별 행을 직접 수정할 수 있습니다. 변경된 행만 서버에 반영됩니다.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="border border-border-subtle bg-elevated p-3 space-y-2">
                <p className="text-small text-fg-primary font-medium">
                  패턴 적용 (선택)
                </p>
                <div className="flex items-end gap-2 flex-wrap">
                  <div>
                    <label
                      htmlFor="bulk-rename-classroom-find-input"
                      className="text-small text-fg-secondary block mb-1"
                    >
                      찾기
                    </label>
                    <input
                      id="bulk-rename-classroom-find-input"
                      type="text"
                      value={findText}
                      onChange={(e) => setFindText(e.target.value)}
                      data-testid="bulk-rename-classroom-find-input"
                      className="border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
                      placeholder="예: 2025"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="bulk-rename-classroom-replace-input"
                      className="text-small text-fg-secondary block mb-1"
                    >
                      바꾸기
                    </label>
                    <input
                      id="bulk-rename-classroom-replace-input"
                      type="text"
                      value={replaceText}
                      onChange={(e) => setReplaceText(e.target.value)}
                      data-testid="bulk-rename-classroom-replace-input"
                      className="border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
                      placeholder="예: 2026"
                    />
                  </div>
                  <Button
                    variant="secondary"
                    onClick={applyPattern}
                    disabled={findText.length === 0}
                    data-testid="bulk-rename-classroom-apply-pattern-btn"
                  >
                    전체 적용
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={resetRows}
                    data-testid="bulk-rename-classroom-reset-btn"
                  >
                    원래대로
                  </Button>
                </div>
                <p className="text-small text-fg-muted">
                  대소문자 · 공백 그대로 매칭. 정규식이 아닌 단순 문자열 치환.
                </p>
              </div>

              <div
                className="max-h-72 overflow-y-auto border border-border-subtle"
                data-testid="bulk-rename-classroom-rows"
              >
                <table className="w-full text-small">
                  <thead className="bg-elevated">
                    <tr className="text-fg-secondary">
                      <th scope="col" className="text-left px-2 py-1 font-normal">
                        현재 이름
                      </th>
                      <th scope="col" className="text-left px-2 py-1 font-normal">
                        새 이름
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const changed = r.newName.trim() !== r.originalName.trim();
                      const invalid = r.newName.trim().length === 0;
                      const tooLong = r.newName.length > COURSE_NAME_MAX;
                      const rowError = invalid || tooLong;
                      const inputId = `bulk-rename-classroom-row-input-${r.id}`;
                      return (
                        <tr
                          key={r.id}
                          className="border-t border-border-subtle"
                          data-testid={`bulk-rename-classroom-row-${r.id}`}
                        >
                          <td className="px-2 py-1 text-fg-secondary align-top">
                            <label htmlFor={inputId} className="cursor-text">
                              {r.originalName || <span className="text-fg-muted">(무제)</span>}
                            </label>
                          </td>
                          <td className="px-2 py-1">
                            <input
                              id={inputId}
                              type="text"
                              value={r.newName}
                              onChange={(e) => updateRowName(r.id, e.target.value)}
                              data-testid={`bulk-rename-classroom-row-input-${r.id}`}
                              aria-invalid={rowError || undefined}
                              className={`w-full border bg-canvas px-2 py-1 text-body focus:outline-none focus:ring-1 ${
                                rowError
                                  ? 'border-state-danger text-state-danger focus:border-state-danger focus:ring-state-danger'
                                  : changed
                                    ? 'border-fg-primary text-fg-primary focus:border-fg-primary focus:ring-fg-primary'
                                    : 'border-border-subtle text-fg-primary focus:border-border-strong focus:ring-border-strong'
                              }`}
                            />
                            {/* v0.190: row-level 실시간 카운터 (v0.180/v0.188 스타일 통일).
                                기존 tooLong warn 은 유지 (더 명시적 안내). */}
                            <p
                              className={`mt-1 text-small ${
                                tooLong ? 'text-state-danger' : 'text-fg-muted'
                              }`}
                              data-testid={`bulk-rename-classroom-row-counter-${r.id}`}
                            >
                              {r.newName.length.toLocaleString()} /{' '}
                              {COURSE_NAME_MAX.toLocaleString()} 자
                            </p>
                            {tooLong && (
                              <p
                                className="mt-1 text-micro text-state-danger"
                                data-testid={`bulk-rename-classroom-row-too-long-${r.id}`}
                              >
                                최대 {COURSE_NAME_MAX.toLocaleString()}자 초과 (현재{' '}
                                {r.newName.length.toLocaleString()}자)
                              </p>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <p className="text-small text-fg-secondary" data-testid="bulk-rename-classroom-summary">
                변경 대상:{' '}
                <strong className="font-mono text-fg-primary">{changedRows.length}</strong>
                개 · 무변경{' '}
                {rows.length - changedRows.length - invalidRows.length - overlyLongRows.length}개
                {invalidRows.length > 0 && (
                  <>
                    {' · '}
                    <span className="text-state-danger font-mono">
                      빈 이름 {invalidRows.length}
                    </span>
                    개 (수정 필요)
                  </>
                )}
                {overlyLongRows.length > 0 && (
                  <>
                    {' · '}
                    <span
                      className="text-state-danger font-mono"
                      data-testid="bulk-rename-classroom-too-long-summary"
                    >
                      상한 초과 {overlyLongRows.length}
                    </span>
                    개 (최대 {COURSE_NAME_MAX.toLocaleString()}자)
                  </>
                )}
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="secondary"
                onClick={() => handleOpenChange(false)}
                data-testid="bulk-rename-classroom-cancel-btn"
              >
                취소
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={!canConfirm}
                data-testid="bulk-rename-classroom-confirm-btn"
              >
                {changedRows.length}개 이름 변경
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === 'running' && (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>일괄 이름 변경 진행 중</DialogTitle>
              <DialogDescription>
                클래스룸 이름을 변경하고 있습니다.
              </DialogDescription>
            </DialogHeader>
            <div
              className="py-8 text-center space-y-3"
              data-testid="bulk-rename-classroom-running"
            >
              <div className="text-body text-fg-primary">
                진행 중: <strong className="font-mono">{progress}</strong> /{' '}
                <strong className="font-mono">{activeRows.length}</strong>
              </div>
              <div className="w-full bg-canvas h-2 border border-border-subtle">
                <div
                  className="bg-fg-primary h-full transition-all"
                  style={{
                    width: `${activeRows.length > 0 ? (progress / activeRows.length) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </>
        )}

        {phase === 'done' && (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>일괄 이름 변경 완료</DialogTitle>
              <DialogDescription>일괄 이름 변경이 완료되었습니다.</DialogDescription>
            </DialogHeader>
            <div data-testid="bulk-rename-classroom-done" className="space-y-3">
              <p className="text-body text-fg-primary">
                완료:{' '}
                <strong className="text-state-success font-mono">
                  {activeRows.length - failures.length}
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
                  data-testid="bulk-rename-classroom-failures"
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
