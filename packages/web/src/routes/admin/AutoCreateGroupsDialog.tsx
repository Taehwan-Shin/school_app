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
import { Banner } from '../../components/Banner';
import { ConfirmCountInput } from '../../components/ConfirmCountInput';
import { BulkProgress } from '../../components/BulkProgress';
import { BulkDoneSummary } from '../../components/BulkDoneSummary';
import { BulkFailureList } from '../../components/BulkFailureList';
import { SrOnlyDialogHeader } from '../../components/SrOnlyDialogHeader';
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

  const emailCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of targets) {
      counts[t.email] = (counts[t.email] ?? 0) + 1;
    }
    return counts;
  }, [targets]);

  const duplicateEmails = useMemo(
    () => Object.entries(emailCounts).filter(([_, c]) => c > 1).map(([e]) => e),
    [emailCounts]
  );
  const hasDuplicates = duplicateEmails.length > 0;

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
    if (hasDuplicates) return;
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
                    <tr key={`${t.grade}-${t.class}`}>
                      <td className="py-2 px-3 font-mono text-fg-primary">{t.email}</td>
                      <td className="py-2 px-3 text-fg-secondary">{t.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* v0.249: Banner 이식. */}
            <Banner
              variant="error"
              message={
                hasDuplicates
                  ? `다음 이메일이 중복됩니다 (${duplicateEmails.length}건): ${duplicateEmails.slice(0, 3).join(', ')}${duplicateEmails.length > 3 ? ` 외 ${duplicateEmails.length - 3}` : ''}. 반 이름을 구분되게 조정하세요.`
                  : null
              }
              testId="auto-create-groups-duplicate-error"
            />

            {/* v0.255: ConfirmCountInput 이식. 원본 label htmlFor 없었으나 신규 컴포넌트가 id/htmlFor 자동 연결 (접근성 개선). */}
            <ConfirmCountInput
              expectedCount={targets.length}
              value={confirmText}
              onChange={setConfirmText}
              idPrefix="auto-create-groups"
            />
            <DialogFooter>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                취소
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={
                  confirmText.trim() !== String(targets.length) ||
                  targets.length === 0 ||
                  !/^[a-z0-9-]+$/.test(prefix) ||
                  hasDuplicates
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
            {/* v0.278: SrOnlyDialogHeader 이식. */}
            <SrOnlyDialogHeader title="그룹 자동 생성 진행 중" description="그룹을 자동 생성하고 있습니다." />
            {/* v0.259: BulkProgress 이식. */}
            <BulkProgress
              progress={progress}
              total={totalOpsDisplay}
              testId="auto-create-groups-running"
            />
          </>
        )}

        {phase === 'done' && (
          <>
            {/* v0.278: SrOnlyDialogHeader 이식. */}
            <SrOnlyDialogHeader title="그룹 자동 생성 완료" description="그룹 자동 생성 작업이 완료되었습니다." />
            <div data-testid="auto-create-groups-done" className="space-y-3">
              {(() => {
                const okCount = results.filter((r) => r.kind === 'ok').length;
                const skippedCount = results.filter((r) => r.kind === 'skipped').length;
                const failedCount = results.filter((r) => r.kind === 'failed').length;
                return (
                  /* v0.268: BulkDoneSummary 이식 (3-category, skippedSuffix 커스텀). */
                  <BulkDoneSummary
                    successCount={okCount}
                    failureCount={failedCount}
                    unit="개"
                    skippedCount={skippedCount}
                    skippedSuffix="이미 존재 (skip)"
                  />
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
              {/* v0.273: BulkFailureList 이식 (failed filter). */}
              <BulkFailureList
                items={results.filter((r) => r.kind === 'failed')}
                getKey={(r) => r.email}
                renderItem={(r) => (
                  <>
                    <span className="font-mono">{r.email}</span>: {r.message}
                  </>
                )}
                testId="auto-create-groups-failures"
              />
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
