import { useState, useEffect, useContext } from 'react';
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
import { callGroupsCreate } from '../../api/groupsCreate';
import { callGroupsMembersInsert } from '../../api/groupsMembersInsert';

export interface AutoCreateDepartmentGroupsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
  departments: string[]; // basic_data.departments
  onDone?: () => void;
}

const ALLOWED_DOMAIN = 'cam.hs.kr';
const SLUG_REGEX = /^[a-z0-9-]+$/; // 소문자·숫자·하이픈만

export function buildDeptGroupEmail(slug: string): string {
  return `${slug}@${ALLOWED_DOMAIN}`;
}

export function buildDeptGroupName(deptName: string): string {
  return deptName; // 원본 그대로
}

export function buildDeptGroupDescription(year: number, deptName: string): string {
  return `${year}년 ${deptName} 자동 생성`;
}

export function defaultSlug(index: number): string {
  return `dept-${index + 1}`;
}

type Phase = 'confirm' | 'running' | 'done';
type ResultKind = 'ok' | 'skipped' | 'failed';
type Result = { deptName: string; email: string; kind: ResultKind; message?: string };

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

export function AutoCreateDepartmentGroupsDialog({
  open,
  onOpenChange,
  year,
  departments,
  onDone,
}: AutoCreateDepartmentGroupsDialogProps) {
  const queryClient = useContext(QueryClientContext);
  const [phase, setPhase] = useState<Phase>('confirm');
  const [slugs, setSlugs] = useState<string[]>([]); // departments 와 index 동기화
  const [owners, setOwners] = useState<string[]>([]); // department index 와 동기화, 빈 문자열 허용
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<Result[]>([]);

  useEffect(() => {
    if (open) {
      setPhase('confirm');
      setProgress(0);
      setResults([]);
      setSlugs(departments.map((_, i) => defaultSlug(i)));
      setOwners(departments.map(() => ''));
    }
  }, [open, departments]);

  const preview = departments.map((dept, i) => {
    const slug = (slugs[i] ?? '').trim().toLowerCase();
    const validSlug = SLUG_REGEX.test(slug);
    const ownerRaw = (owners[i] ?? '').trim();
    const validOwner = ownerRaw === '' || /^[^\s@]+@cam\.hs\.kr$/i.test(ownerRaw);
    return {
      deptName: dept,
      slug,
      email: validSlug ? buildDeptGroupEmail(slug) : '',
      validSlug,
      owner: ownerRaw === '' ? undefined : ownerRaw,
      validOwner,
    };
  });

  const allValid = preview.every((p) => p.validSlug && p.validOwner);
  const noDuplicates = new Set(preview.map((p) => p.slug)).size === preview.length;
  const canConfirm = allValid && noDuplicates && preview.length > 0;
  const totalOps = preview.reduce((sum, p) => sum + 1 + (p.owner ? 1 : 0), 0);

  const handleOpenChange = (newOpen: boolean) => {
    if (phase === 'running') return;
    onOpenChange(newOpen);
  };

  const handleConfirm = async () => {
    setPhase('running');
    const localResults: Result[] = [];
    let opProgress = 0;

    for (let i = 0; i < preview.length; i++) {
      const p = preview[i];
      let groupOk = false;
      try {
        await callGroupsCreate({
          email: p.email,
          name: buildDeptGroupName(p.deptName),
          description: buildDeptGroupDescription(year, p.deptName),
        });
        localResults.push({ deptName: p.deptName, email: p.email, kind: 'ok' });
        groupOk = true;
      } catch (e) {
        const message = (e as Error).message;
        const kind = isAlreadyExistsError(message) ? 'skipped' : 'failed';
        localResults.push({ deptName: p.deptName, email: p.email, kind, message });
        groupOk = kind === 'skipped'; // 이미 존재하는 그룹에도 owner 초대 시도
      }
      opProgress++;
      setProgress(opProgress);

      // owner 지정 시도
      if (p.owner && groupOk) {
        try {
          await callGroupsMembersInsert({
            groupEmail: p.email,
            memberEmail: p.owner,
            role: 'OWNER',
          });
          localResults.push({ deptName: `${p.deptName} → owner`, email: p.owner, kind: 'ok' });
        } catch (e) {
          const message = (e as Error).message;
          const kind = isAlreadyMemberError(message) ? 'skipped' : 'failed';
          localResults.push({ deptName: `${p.deptName} → owner`, email: p.owner, kind, message });
        }
        opProgress++;
        setProgress(opProgress);
      }
    }
    setResults(localResults);
    setPhase('done');
    queryClient?.invalidateQueries({ queryKey: ['groups', 'list'] });
    if (preview.some((p) => p.owner)) {
      queryClient?.invalidateQueries({ queryKey: ['groups', 'members'] });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={phase === 'running' ? '[&>button]:hidden' : undefined}>
        {phase === 'confirm' && (
          <>
            <DialogHeader>
              <DialogTitle>부서 그룹 자동 생성</DialogTitle>
              <DialogDescription>
                {year}년도 {departments.length}개 부서 그룹을 생성합니다. 각 부서의 slug (이메일 로컬 파트) 를 지정하세요.
              </DialogDescription>
            </DialogHeader>
            <div
              className="max-h-64 overflow-y-auto border border-border-subtle"
              data-testid="auto-create-dept-groups-targets"
            >
              <table className="w-full text-small">
                <thead className="bg-canvas border-b border-border-subtle text-fg-secondary text-left sticky top-0">
                  <tr>
                    <th className="py-2 px-3 font-medium">부서</th>
                    <th className="py-2 px-3 font-medium">Slug</th>
                    <th className="py-2 px-3 font-medium">이메일</th>
                    <th className="py-2 px-3 font-medium">부서장 (선택)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {departments.map((dept, i) => (
                    <tr key={`${dept}-${i}`}>
                      <td className="py-2 px-3 text-fg-primary">{dept}</td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={slugs[i] ?? ''}
                          onChange={(e) => {
                            const next = [...slugs];
                            next[i] = e.target.value;
                            setSlugs(next);
                          }}
                          data-testid={`auto-create-dept-slug-${i}`}
                          className={
                            preview[i]?.validSlug
                              ? 'w-32 border border-border-subtle bg-canvas px-2 py-1 text-small font-mono text-fg-primary focus:outline-none focus:border-border-strong'
                              : 'w-32 border border-state-danger bg-canvas px-2 py-1 text-small font-mono text-fg-primary focus:outline-none'
                          }
                        />
                      </td>
                      <td className="py-2 px-3 font-mono text-fg-secondary">
                        {preview[i]?.validSlug ? preview[i].email : <span className="text-state-danger">invalid</span>}
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="email"
                          value={owners[i] ?? ''}
                          onChange={(e) => {
                            const next = [...owners];
                            next[i] = e.target.value;
                            setOwners(next);
                          }}
                          placeholder="teacher@cam.hs.kr"
                          data-testid={`auto-create-dept-owner-${i}`}
                          className={
                            preview[i]?.validOwner
                              ? 'w-48 border border-border-subtle bg-canvas px-2 py-1 text-small font-mono text-fg-primary focus:outline-none focus:border-border-strong'
                              : 'w-48 border border-state-danger bg-canvas px-2 py-1 text-small font-mono text-fg-primary focus:outline-none'
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!allValid && (
              <p className="text-small text-state-danger">일부 slug 또는 부서장 이메일이 유효하지 않습니다.</p>
            )}
            {!noDuplicates && (
              <p className="text-small text-state-danger">중복된 slug 이 있습니다.</p>
            )}
            <DialogFooter>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                취소
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={!canConfirm || departments.length === 0}
                data-testid="auto-create-dept-groups-confirm-btn"
              >
                생성 실행
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === 'running' && (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>부서 그룹 자동 생성 진행 중</DialogTitle>
              <DialogDescription>부서 그룹을 자동 생성하고 있습니다.</DialogDescription>
            </DialogHeader>
            <div className="py-8 text-center space-y-3" data-testid="auto-create-dept-groups-running">
              <div className="text-body text-fg-primary">
                진행 중: <strong className="font-mono">{progress}</strong> /{' '}
                <strong className="font-mono">{totalOps}</strong>
              </div>
              <div className="w-full bg-canvas h-2 border border-border-subtle">
                <div
                  className="bg-fg-primary h-full transition-all"
                  style={{
                    width: `${totalOps > 0 ? (progress / totalOps) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </>
        )}

        {phase === 'done' && (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>부서 그룹 자동 생성 완료</DialogTitle>
              <DialogDescription>부서 그룹 자동 생성 작업이 완료되었습니다.</DialogDescription>
            </DialogHeader>
            <div data-testid="auto-create-dept-groups-done" className="space-y-3">
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
                  data-testid="auto-create-dept-groups-skipped"
                >
                  {results
                    .filter((r) => r.kind === 'skipped')
                    .map((r, i) => (
                      <li key={`${r.deptName}-${r.email}-${i}`}>
                        <span className="font-mono">{r.email}</span>: 이미 존재
                      </li>
                    ))}
                </ul>
              )}
              {results.some((r) => r.kind === 'failed') && (
                <ul
                  className="text-small text-state-danger space-y-1 max-h-40 overflow-y-auto"
                  data-testid="auto-create-dept-groups-failures"
                >
                  {results
                    .filter((r) => r.kind === 'failed')
                    .map((r, i) => (
                      <li key={`${r.deptName}-${r.email}-${i}`}>
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
