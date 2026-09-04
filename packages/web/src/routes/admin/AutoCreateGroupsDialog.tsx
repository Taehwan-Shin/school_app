import { useState, useEffect, useMemo, useContext } from 'react';
import { QueryClientContext } from '@tanstack/react-query';
import type { BasicDataGradeClass } from '@school-app/shared';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { callGroupsCreate } from '../../api/groupsCreate';

export interface AutoCreateGroupsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
  grades: BasicDataGradeClass[];
  onDone?: () => void;
}

const ALLOWED_DOMAIN = 'cam.hs.kr';

export function buildGroupEmail(grade: number, cls: string): string {
  // 예: grade=1, cls='A' → 'class-1a@cam.hs.kr'
  //     grade=10, cls='B' → 'class-10b@cam.hs.kr'
  const clsSlug = cls.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `class-${grade}${clsSlug}@${ALLOWED_DOMAIN}`;
}

export function buildGroupName(grade: number, cls: string): string {
  return `${grade}학년 ${cls}반`;
}

export function buildGroupDescription(year: number, grade: number, cls: string): string {
  return `${year}년 ${grade}학년 ${cls}반 자동 생성`;
}

type Phase = 'confirm' | 'running' | 'done';
type ResultKind = 'ok' | 'skipped' | 'failed';
type Result = { email: string; kind: ResultKind; message?: string };

export function isAlreadyExistsError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('already exists') ||
    lower.includes('entityalreadyexists') ||
    lower.includes('duplicate') ||
    lower.includes('http_409')
  );
}

export function AutoCreateGroupsDialog({
  open,
  onOpenChange,
  year,
  grades,
  onDone,
}: AutoCreateGroupsDialogProps) {
  const queryClient = useContext(QueryClientContext);
  const [phase, setPhase] = useState<Phase>('confirm');
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const [confirmText, setConfirmText] = useState('');

  const targets = useMemo(
    () =>
      (grades ?? []).flatMap((g) =>
        (g.classes ?? []).map((c) => ({
          grade: g.grade,
          class: c,
          email: buildGroupEmail(g.grade, c),
          name: buildGroupName(g.grade, c),
          description: buildGroupDescription(year, g.grade, c),
        }))
      ),
    [grades, year]
  );

  useEffect(() => {
    if (open) {
      setPhase('confirm');
      setProgress(0);
      setResults([]);
      setConfirmText('');
    }
  }, [open]);

  const handleOpenChange = (newOpen: boolean) => {
    if (phase === 'running') return;
    onOpenChange(newOpen);
  };

  const handleConfirm = async () => {
    setPhase('running');
    const localResults: Result[] = [];
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      try {
        await callGroupsCreate({
          email: t.email,
          name: t.name,
          description: t.description,
        });
        localResults.push({ email: t.email, kind: 'ok' });
      } catch (e) {
        const message = (e as Error).message;
        if (isAlreadyExistsError(message)) {
          localResults.push({ email: t.email, kind: 'skipped', message });
        } else {
          localResults.push({ email: t.email, kind: 'failed', message });
        }
      }
      setProgress(i + 1);
    }
    setResults(localResults);
    setPhase('done');
    queryClient?.invalidateQueries({ queryKey: ['groups', 'list'] });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={phase === 'running' ? '[&>button]:hidden' : undefined}>
        {phase === 'confirm' && (
          <>
            <DialogHeader>
              <DialogTitle>그룹 자동 생성 미리보기</DialogTitle>
              <DialogDescription>
                {year}년도 학년·반 구조로 {targets.length}개 반 그룹을 자동 생성합니다.
              </DialogDescription>
            </DialogHeader>
            <div
              className="max-h-48 overflow-y-auto border border-border-subtle"
              data-testid="auto-create-groups-targets"
            >
              <table className="w-full text-small">
                <thead className="bg-canvas border-b border-border-subtle text-fg-secondary text-left sticky top-0">
                  <tr>
                    <th className="py-2 px-3 font-medium">이메일</th>
                    <th className="py-2 px-3 font-medium">그룹 이름</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {targets.map((t) => (
                    <tr key={t.email}>
                      <td className="py-2 px-3 font-mono text-fg-primary">{t.email}</td>
                      <td className="py-2 px-3 text-fg-secondary">{t.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <label className="text-small text-fg-primary">
                확인을 위해 대상 개수 (<strong>{targets.length}</strong>)를 입력하세요:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                data-testid="auto-create-groups-confirm-input"
                className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong mt-2"
              />
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                취소
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={confirmText.trim() !== String(targets.length) || targets.length === 0}
                data-testid="auto-create-groups-confirm-btn"
              >
                생성 실행
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === 'running' && (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>그룹 자동 생성 진행 중</DialogTitle>
              <DialogDescription>그룹을 자동 생성하고 있습니다.</DialogDescription>
            </DialogHeader>
            <div className="py-8 text-center space-y-3" data-testid="auto-create-groups-running">
              <div className="text-body text-fg-primary">
                진행 중: <strong className="font-mono">{progress}</strong> /{' '}
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
              <DialogTitle>그룹 자동 생성 완료</DialogTitle>
              <DialogDescription>그룹 자동 생성 작업이 완료되었습니다.</DialogDescription>
            </DialogHeader>
            <div data-testid="auto-create-groups-done" className="space-y-3">
              {(() => {
                const okCount = results.filter((r) => r.kind === 'ok').length;
                const skippedCount = results.filter((r) => r.kind === 'skipped').length;
                const failedCount = results.filter((r) => r.kind === 'failed').length;
                return (
                  <p className="text-body text-fg-primary">
                    완료:{' '}
                    <strong className="text-state-success font-mono">{okCount}</strong>개 성공
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
                  data-testid="auto-create-groups-skipped"
                >
                  {results
                    .filter((r) => r.kind === 'skipped')
                    .map((r) => (
                      <li key={r.email}>
                        <span className="font-mono">{r.email}</span>: 이미 존재
                      </li>
                    ))}
                </ul>
              )}
              {results.some((r) => r.kind === 'failed') && (
                <ul
                  className="text-small text-state-danger space-y-1 max-h-40 overflow-y-auto"
                  data-testid="auto-create-groups-failures"
                >
                  {results
                    .filter((r) => r.kind === 'failed')
                    .map((r) => (
                      <li key={r.email}>
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
