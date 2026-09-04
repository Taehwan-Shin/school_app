import { useState, useEffect, useMemo, useContext } from 'react';
import { QueryClientContext } from '@tanstack/react-query';
import type { BasicDataYear } from '@school-app/shared';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { callGroupsMembersInsert } from '../../api/groupsMembersInsert';

export interface AutoInviteStudentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
  data: BasicDataYear; // grades + rosters
  onDone?: () => void;
}

export const ALLOWED_DOMAIN = 'cam.hs.kr';

export function buildGroupEmail(grade: number, cls: string, prefix: string = 'class'): string {
  const clsSlug = cls.toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanPrefix = prefix.toLowerCase().replace(/[^a-z0-9-]/g, '');
  return `${cleanPrefix}-${grade}${clsSlug}@${ALLOWED_DOMAIN}`;
}

export function isAlreadyMemberError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('already') ||
    lower.includes('duplicate') ||
    lower.includes('member exists') ||
    lower.includes('http_409')
  );
}

type Phase = 'confirm' | 'running' | 'done';
type ResultKind = 'ok' | 'skipped' | 'failed';
type Result = {
  groupEmail: string;
  memberEmail: string;
  kind: ResultKind;
  message?: string;
};

export function AutoInviteStudentsDialog({
  open,
  onOpenChange,
  year,
  data,
  onDone,
}: AutoInviteStudentsDialogProps) {
  const queryClient = useContext(QueryClientContext);
  const [phase, setPhase] = useState<Phase>('confirm');
  const [prefix, setPrefix] = useState('class');
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<Result[]>([]);

  const targets = useMemo(() => {
    const out: { groupEmail: string; memberEmail: string; grade: number; class: string }[] = [];
    for (const g of data?.grades ?? []) {
      for (const c of g?.classes ?? []) {
        const students = data?.rosters?.[String(g.grade)]?.[c] ?? [];
        const groupEmail = buildGroupEmail(g.grade, c, prefix);
        for (const s of students) {
          out.push({ groupEmail, memberEmail: s, grade: g.grade, class: c });
        }
      }
    }
    return out;
  }, [data, prefix]);

  useEffect(() => {
    if (open) {
      setPhase('confirm');
      setProgress(0);
      setResults([]);
      setPrefix('class');
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
        await callGroupsMembersInsert({
          groupEmail: t.groupEmail,
          memberEmail: t.memberEmail,
          role: 'MEMBER',
        });
        localResults.push({ groupEmail: t.groupEmail, memberEmail: t.memberEmail, kind: 'ok' });
      } catch (e) {
        const message = (e as Error).message;
        const kind = isAlreadyMemberError(message) ? 'skipped' : 'failed';
        localResults.push({ groupEmail: t.groupEmail, memberEmail: t.memberEmail, kind, message });
      }
      setProgress(i + 1);
    }
    setResults(localResults);
    setPhase('done');
    queryClient?.invalidateQueries({ queryKey: ['groups', 'members'] });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={phase === 'running' ? '[&>button]:hidden' : undefined}>
        {phase === 'confirm' && (
          <>
            <DialogHeader>
              <DialogTitle>학생 자동 초대</DialogTitle>
              <DialogDescription>
                {year}년 rosters 기준 {targets.length}명 학생을 반 그룹에 초대합니다.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1">
              <label className="text-small text-fg-primary">
                그룹 이메일 접두사 (기본 <code className="font-mono">class</code>):
              </label>
              <input
                type="text"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                data-testid="auto-invite-students-prefix-input"
                className={
                  /^[a-z0-9-]+$/.test(prefix)
                    ? 'w-40 border border-border-subtle bg-canvas px-3 py-2 text-body font-mono text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong'
                    : 'w-40 border border-state-danger bg-canvas px-3 py-2 text-body font-mono text-fg-primary focus:outline-none'
                }
              />
              <p className="text-micro text-fg-muted">
                AutoCreateGroups 에서 사용한 접두사와 동일해야 실 그룹에 초대됩니다.
              </p>
            </div>
            <div
              className="max-h-48 overflow-y-auto border border-border-subtle"
              data-testid="auto-invite-students-targets"
            >
              <table className="w-full text-small">
                <thead className="bg-canvas border-b border-border-subtle text-fg-secondary text-left sticky top-0">
                  <tr>
                    <th className="py-2 px-3 font-medium">그룹</th>
                    <th className="py-2 px-3 font-medium">학생</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {targets.slice(0, 20).map((t, i) => (
                    <tr key={`${t.groupEmail}-${t.memberEmail}-${i}`}>
                      <td className="py-2 px-3 font-mono text-fg-primary">{t.groupEmail}</td>
                      <td className="py-2 px-3 text-fg-secondary">{t.memberEmail}</td>
                    </tr>
                  ))}
                  {targets.length > 20 && (
                    <tr>
                      <td colSpan={2} className="py-2 px-3 text-fg-muted text-center">
                        ... 외 {targets.length - 20}건
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                취소
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={targets.length === 0 || !/^[a-z0-9-]+$/.test(prefix)}
                data-testid="auto-invite-students-confirm-btn"
              >
                초대 실행
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === 'running' && (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>학생 자동 초대 진행 중</DialogTitle>
              <DialogDescription>학생들을 반 그룹에 자동 초대하고 있습니다.</DialogDescription>
            </DialogHeader>
            <div className="py-8 text-center space-y-3" data-testid="auto-invite-students-running">
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
              <DialogTitle>학생 자동 초대 완료</DialogTitle>
              <DialogDescription>학생 자동 초대 작업이 완료되었습니다.</DialogDescription>
            </DialogHeader>
            <div data-testid="auto-invite-students-done" className="space-y-3">
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
                        · <strong className="text-state-warning font-mono">{skippedCount}</strong>개 이미 멤버 (skip)
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
                  data-testid="auto-invite-students-skipped"
                >
                  {results
                    .filter((r) => r.kind === 'skipped')
                    .map((r, i) => (
                      <li key={`${r.groupEmail}-${r.memberEmail}-${i}`}>
                        <span className="font-mono">{r.memberEmail}</span>: 이미 멤버
                      </li>
                    ))}
                </ul>
              )}
              {results.some((r) => r.kind === 'failed') && (
                <ul
                  className="text-small text-state-danger space-y-1 max-h-40 overflow-y-auto"
                  data-testid="auto-invite-students-failures"
                >
                  {results
                    .filter((r) => r.kind === 'failed')
                    .map((r, i) => (
                      <li key={`${r.groupEmail}-${r.memberEmail}-${i}`}>
                        <span className="font-mono">{r.memberEmail}</span>: {r.message}
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
