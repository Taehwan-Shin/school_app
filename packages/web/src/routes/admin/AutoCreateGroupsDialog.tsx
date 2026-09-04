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
import { callGroupsMembersInsert } from '../../api/groupsMembersInsert';

export interface AutoCreateGroupsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
  grades: BasicDataGradeClass[];
  rosters?: Record<string, Record<string, string[]>>;
  onDone?: () => void;
}

const ALLOWED_DOMAIN = 'cam.hs.kr';

export function buildGroupEmail(grade: number, cls: string, prefix: string = 'class'): string {
  // 예: grade=1, cls='A' → 'class-1a@cam.hs.kr'
  //     grade=10, cls='B' → 'class-10b@cam.hs.kr'
  const clsSlug = cls.toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanPrefix = prefix.toLowerCase().replace(/[^a-z0-9-]/g, '');
  return `${cleanPrefix}-${grade}${clsSlug}@${ALLOWED_DOMAIN}`;
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

export function isAlreadyMemberError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('already') ||
    lower.includes('duplicate') ||
    lower.includes('member exists') ||
    lower.includes('http_409')
  );
}

export function AutoCreateGroupsDialog({
  open,
  onOpenChange,
  year,
  grades,
  rosters,
  onDone,
}: AutoCreateGroupsDialogProps) {
  const queryClient = useContext(QueryClientContext);
  const [phase, setPhase] = useState<Phase>('confirm');
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const [confirmText, setConfirmText] = useState('');
  const [prefix, setPrefix] = useState('class');
  const [inviteStudents, setInviteStudents] = useState(false);

  const targets = useMemo(
    () =>
      (grades ?? []).flatMap((g) =>
        (g.classes ?? []).map((c) => ({
          grade: g.grade,
          class: c,
          email: buildGroupEmail(g.grade, c, prefix),
          name: buildGroupName(g.grade, c),
          description: buildGroupDescription(year, g.grade, c),
        }))
      ),
    [grades, year, prefix]
  );

  const totalStudents = useMemo(() => {
    if (!inviteStudents || !rosters) return 0;
    return targets.reduce((sum, t) => sum + (rosters[String(t.grade)]?.[t.class]?.length ?? 0), 0);
  }, [inviteStudents, rosters, targets]);
  const totalOpsDisplay = targets.length + totalStudents;

  useEffect(() => {
    if (open) {
      setPhase('confirm');
      setProgress(0);
      setResults([]);
      setConfirmText('');
      setPrefix('class');
      setInviteStudents(false);
    }
  }, [open]);

  const handleOpenChange = (newOpen: boolean) => {
    if (phase === 'running') return;
    onOpenChange(newOpen);
  };

  const handleConfirm = async () => {
    setPhase('running');
    const localResults: Result[] = [];
    let opProgress = 0;

    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      let groupOk = false;
      try {
        await callGroupsCreate({
          email: t.email,
          name: t.name,
          description: t.description,
        });
        localResults.push({ email: t.email, kind: 'ok' });
        groupOk = true;
      } catch (e) {
        const message = (e as Error).message;
        const kind = isAlreadyExistsError(message) ? 'skipped' : 'failed';
        localResults.push({ email: t.email, kind, message });
        groupOk = kind === 'skipped'; // 이미 있는 그룹에도 학생 초대는 시도
      }
      opProgress++;
      setProgress(opProgress);

      // 학생 초대 (checkbox 체크 시 · 그룹 생성 성공 or 이미 존재 시만)
      if (inviteStudents && groupOk) {
        const students = rosters?.[String(t.grade)]?.[t.class] ?? [];
        for (const memberEmail of students) {
          try {
            await callGroupsMembersInsert({
              groupEmail: t.email,
              memberEmail,
              role: 'MEMBER',
            });
            localResults.push({ email: `${t.email} → ${memberEmail}`, kind: 'ok' });
          } catch (e) {
            const message = (e as Error).message;
            const kind = isAlreadyMemberError(message) ? 'skipped' : 'failed';
            localResults.push({ email: `${t.email} → ${memberEmail}`, kind, message });
          }
          opProgress++;
          setProgress(opProgress);
        }
      }
    }

    setResults(localResults);
    setPhase('done');
    queryClient?.invalidateQueries({ queryKey: ['groups', 'list'] });
    if (inviteStudents) {
      queryClient?.invalidateQueries({ queryKey: ['groups', 'members'] });
    }
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
            <div className="space-y-1">
              <label className="text-small text-fg-primary">
                이메일 접두사 (기본 <code className="font-mono">class</code>):
              </label>
              <input
                type="text"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder="class"
                data-testid="auto-create-groups-prefix-input"
                className={
                  /^[a-z0-9-]+$/.test(prefix)
                    ? 'w-40 border border-border-subtle bg-canvas px-3 py-2 text-body font-mono text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong'
                    : 'w-40 border border-state-danger bg-canvas px-3 py-2 text-body font-mono text-fg-primary focus:outline-none'
                }
              />
              <p className="text-micro text-fg-muted">
                소문자·숫자·하이픈만. 예: <code className="font-mono">homeroom</code>, <code className="font-mono">2026</code>
              </p>
            </div>
            <div>
              <label className="flex items-center gap-2 text-body text-fg-primary">
                <input
                  type="checkbox"
                  checked={inviteStudents}
                  disabled={!rosters || Object.keys(rosters).length === 0}
                  onChange={(e) => setInviteStudents(e.target.checked)}
                  data-testid="auto-create-groups-invite-students"
                />
                생성 후 학생 자동 초대 (rosters 기준)
              </label>
              <p className="text-micro text-fg-muted mt-1 ml-6">
                {!rosters || Object.keys(rosters).length === 0
                  ? '학생 명단이 없으면 사용 불가'
                  : '각 반 그룹 생성/이미 존재 시 rosters 학생을 자동 초대'}
              </p>
            </div>
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
                disabled={
                  confirmText.trim() !== String(targets.length) ||
                  targets.length === 0 ||
                  !/^[a-z0-9-]+$/.test(prefix)
                }
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
                <strong className="font-mono">{totalOpsDisplay}</strong>
              </div>
              <div className="w-full bg-canvas h-2 border border-border-subtle">
                <div
                  className="bg-fg-primary h-full transition-all"
                  style={{
                    width: `${totalOpsDisplay > 0 ? (progress / totalOpsDisplay) * 100 : 0}%`,
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
