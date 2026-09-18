// v0.149: 반 그룹의 「기초 데이터 명단에 없는 멤버 자동 제거」 (원본 assignGroups
// 의 「제외」 반대편 워크플로우). AutoInviteStudentsDialog 는 「추가」 만 담당,
// 이 다이얼로그는 「제거」 담당. 향후 v0.150 에서 add+remove diff 통합 가능.
//
// 흐름: 기초 데이터의 각 반 그룹 (class-{grade}{cls}@cam.hs.kr) 을 순회하며
// 실 멤버를 페이지 넘겨 조회한 후 rosters 에 없는 email 을 「제거 후보」 로
// 표시. 사용자 확인 후 순차 삭제 실행. OWNER/MANAGER 는 안전 위해 제거 안 함.

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
import { callGroupsMembersList, type GroupMemberItem } from '../../api/groupsMembersList';
import { callGroupsMembersDelete } from '../../api/groupsMembersDelete';
import { buildGroupEmail } from './AutoInviteStudentsDialog';

export interface AutoRemoveNonRosterMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
  data: BasicDataYear;
  onDone?: () => void;
}

type Phase = 'confirm' | 'scanning' | 'preview' | 'running' | 'done';

interface SurplusEntry {
  groupEmail: string;
  grade: number;
  class: string;
  memberEmail: string;
  role: 'OWNER' | 'MANAGER' | 'MEMBER';
}

type ResultKind = 'ok' | 'failed';
interface RemoveResult {
  groupEmail: string;
  memberEmail: string;
  kind: ResultKind;
  message?: string;
}

// v0.149: 하나의 그룹에서 페이지네이션을 넘겨 전 멤버 fetch. maxResults=200
// (Directory API 상한).
export async function fetchAllGroupMembers(
  groupEmail: string,
): Promise<GroupMemberItem[]> {
  const all: GroupMemberItem[] = [];
  let pageToken: string | undefined;
  // 안전 한계 (100 페이지 × 200 = 20,000 명).
  for (let i = 0; i < 100; i++) {
    const res = await callGroupsMembersList({ groupEmail, maxResults: 200, pageToken });
    all.push(...res.members);
    if (!res.nextPageToken) break;
    pageToken = res.nextPageToken;
  }
  return all;
}

export function AutoRemoveNonRosterMembersDialog({
  open,
  onOpenChange,
  year,
  data,
  onDone,
}: AutoRemoveNonRosterMembersDialogProps) {
  const queryClient = useContext(QueryClientContext);
  const [phase, setPhase] = useState<Phase>('confirm');
  const [prefix, setPrefix] = useState('class');
  const [confirmText, setConfirmText] = useState('');
  const [scanProgress, setScanProgress] = useState(0);
  const [surplus, setSurplus] = useState<SurplusEntry[]>([]);
  const [scanErrors, setScanErrors] = useState<{ groupEmail: string; message: string }[]>(
    [],
  );
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<RemoveResult[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set()); // `${group}::${email}` key.
  const [protectMembersOnly, setProtectMembersOnly] = useState(true);

  // 학년/반 목록 (기초 데이터 기반).
  // v0.149b F131: rosters 「미설정」 반 (undefined) 은 스캔 대상에서 제외 —
  //   빈 배열로 처리하면 실 그룹의 모든 MEMBER 가 제거 대상으로 잡혀 위험.
  //   반드시 rosters 에 명시적 배열 (0명 포함) 이 있는 반만 대상.
  const classSpecs = useMemo(() => {
    const out: { grade: number; class: string; roster: Set<string>; groupEmail: string }[] = [];
    for (const g of data?.grades ?? []) {
      for (const c of g?.classes ?? []) {
        const students = data?.rosters?.[String(g.grade)]?.[c];
        if (students === undefined) continue;
        out.push({
          grade: g.grade,
          class: c,
          roster: new Set(students.map((s) => s.toLowerCase())),
          groupEmail: buildGroupEmail(g.grade, c, prefix),
        });
      }
    }
    return out;
  }, [data, prefix]);

  useEffect(() => {
    if (open) {
      setPhase('confirm');
      setPrefix('class');
      setConfirmText('');
      setScanProgress(0);
      setSurplus([]);
      setScanErrors([]);
      setProgress(0);
      setResults([]);
      setSelected(new Set());
      setProtectMembersOnly(true);
    }
  }, [open]);

  const handleOpenChange = (next: boolean) => {
    if (phase === 'scanning' || phase === 'running') return;
    onOpenChange(next);
  };

  const handleScan = async () => {
    if (!/^[a-z0-9-]+$/.test(prefix)) return;
    setPhase('scanning');
    setScanProgress(0);
    const out: SurplusEntry[] = [];
    const errs: { groupEmail: string; message: string }[] = [];
    for (let i = 0; i < classSpecs.length; i++) {
      const spec = classSpecs[i];
      try {
        const members = await fetchAllGroupMembers(spec.groupEmail);
        for (const m of members) {
          if (m.type !== 'USER') continue;
          const emailLower = (m.email || '').toLowerCase();
          if (!emailLower) continue;
          if (spec.roster.has(emailLower)) continue;
          out.push({
            groupEmail: spec.groupEmail,
            grade: spec.grade,
            class: spec.class,
            memberEmail: m.email,
            role: m.role,
          });
        }
      } catch (e) {
        errs.push({
          groupEmail: spec.groupEmail,
          message: e instanceof Error ? e.message : String(e),
        });
      }
      setScanProgress(i + 1);
    }
    setSurplus(out);
    setScanErrors(errs);
    // 기본 선택: MEMBER 만 (안전).
    const initSel = new Set(
      out
        .filter((s) => s.role === 'MEMBER')
        .map((s) => `${s.groupEmail}::${s.memberEmail}`),
    );
    setSelected(initSel);
    setPhase('preview');
  };

  const eligibleSurplus = useMemo(
    () => (protectMembersOnly ? surplus.filter((s) => s.role === 'MEMBER') : surplus),
    [surplus, protectMembersOnly],
  );
  const toRemove = useMemo(
    () => eligibleSurplus.filter((s) => selected.has(`${s.groupEmail}::${s.memberEmail}`)),
    [eligibleSurplus, selected],
  );

  const handleExecute = async () => {
    if (confirmText !== `제거 ${toRemove.length}`) return;
    setPhase('running');
    setProgress(0);
    const collected: RemoveResult[] = [];
    for (let i = 0; i < toRemove.length; i++) {
      const t = toRemove[i];
      try {
        await callGroupsMembersDelete({
          groupEmail: t.groupEmail,
          memberEmail: t.memberEmail,
        });
        collected.push({ groupEmail: t.groupEmail, memberEmail: t.memberEmail, kind: 'ok' });
      } catch (e) {
        collected.push({
          groupEmail: t.groupEmail,
          memberEmail: t.memberEmail,
          kind: 'failed',
          message: e instanceof Error ? e.message : String(e),
        });
      }
      setProgress(i + 1);
    }
    setResults(collected);
    queryClient?.invalidateQueries({ queryKey: ['groups', 'members'] });
    setPhase('done');
    onDone?.();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={
          phase === 'scanning' || phase === 'running'
            ? '[&>button]:hidden max-w-3xl'
            : 'max-w-3xl'
        }
      >
        {phase === 'confirm' && (
          <>
            <DialogHeader>
              <DialogTitle>반 그룹에서 명단 밖 멤버 자동 제거</DialogTitle>
              <DialogDescription>
                {year}년 rosters 기준 {classSpecs.length}개 반 그룹의 현재 멤버를 스캔하여
                「기초 데이터 명단에 없는 사람」 을 제거 후보로 표시합니다. 원본 Apps Script
                `assignGroups` 의 「제외」 워크플로우 대응.
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
                data-testid="auto-remove-nonroster-prefix-input"
                className={
                  /^[a-z0-9-]+$/.test(prefix)
                    ? 'w-40 border border-border-subtle bg-canvas px-3 py-2 text-body font-mono text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong'
                    : 'w-40 border border-state-danger bg-canvas px-3 py-2 text-body font-mono text-fg-primary focus:outline-none'
                }
              />
              <p className="text-micro text-fg-muted">
                AutoInviteStudentsDialog 와 같은 접두사여야 실 그룹이 매칭됩니다.
              </p>
            </div>
            <p
              className="text-small text-fg-secondary"
              data-testid="auto-remove-nonroster-scan-summary"
            >
              스캔 대상: {classSpecs.length}개 그룹 (각 그룹 최대 20,000 멤버 페이지네이션).
            </p>
          </>
        )}

        {phase === 'scanning' && (
          <div className="space-y-2" data-testid="auto-remove-nonroster-scanning">
            <p className="text-small text-fg-primary">
              스캔 중... {scanProgress} / {classSpecs.length}
            </p>
            <div className="w-full h-2 bg-surface border border-border-subtle">
              <div
                className="h-full bg-fg-primary"
                style={{
                  width: `${classSpecs.length > 0 ? (scanProgress / classSpecs.length) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        )}

        {phase === 'preview' && (
          <>
            <DialogHeader>
              <DialogTitle>제거 후보 미리보기</DialogTitle>
              <DialogDescription>
                기초 데이터 명단에 없는 멤버: 총 {surplus.length}건 (MEMBER {surplus.filter((s) => s.role === 'MEMBER').length} · MANAGER {surplus.filter((s) => s.role === 'MANAGER').length} · OWNER {surplus.filter((s) => s.role === 'OWNER').length}).
                {scanErrors.length > 0 && ` 스캔 실패 그룹 ${scanErrors.length}건.`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-small text-fg-primary">
                <input
                  type="checkbox"
                  checked={protectMembersOnly}
                  onChange={(e) => setProtectMembersOnly(e.target.checked)}
                  data-testid="auto-remove-nonroster-protect-toggle"
                />
                MEMBER 만 대상 (OWNER/MANAGER 보호)
              </label>
            </div>
            {eligibleSurplus.length === 0 ? (
              <p
                className="text-small text-fg-muted py-6 text-center"
                data-testid="auto-remove-nonroster-empty"
              >
                제거 대상이 없습니다. 모든 그룹 멤버가 기초 데이터 명단에 포함되어 있습니다.
              </p>
            ) : (
              <div
                className="max-h-96 overflow-y-auto border border-border-subtle bg-canvas"
                data-testid="auto-remove-nonroster-table"
              >
                <table className="w-full text-small">
                  <thead className="bg-surface border-b border-border-subtle sticky top-0">
                    <tr>
                      <th scope="col" className="p-2 text-left w-8">
                        <input
                          type="checkbox"
                          aria-label="전체 선택"
                          checked={
                            eligibleSurplus.length > 0 &&
                            eligibleSurplus.every((s) =>
                              selected.has(`${s.groupEmail}::${s.memberEmail}`),
                            )
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelected(
                                new Set(
                                  eligibleSurplus.map((s) => `${s.groupEmail}::${s.memberEmail}`),
                                ),
                              );
                            } else {
                              setSelected(new Set());
                            }
                          }}
                          data-testid="auto-remove-nonroster-select-all"
                        />
                      </th>
                      <th scope="col" className="p-2 text-left">그룹 (학년-반)</th>
                      <th scope="col" className="p-2 text-left">멤버</th>
                      <th scope="col" className="p-2 text-left">역할</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eligibleSurplus.map((s) => {
                      const key = `${s.groupEmail}::${s.memberEmail}`;
                      return (
                        <tr
                          key={key}
                          className="border-b border-border-subtle last:border-0"
                          data-testid={`auto-remove-nonroster-row-${key}`}
                        >
                          <td className="p-2">
                            <input
                              type="checkbox"
                              checked={selected.has(key)}
                              onChange={(e) => {
                                setSelected((prev) => {
                                  const next = new Set(prev);
                                  if (e.target.checked) next.add(key);
                                  else next.delete(key);
                                  return next;
                                });
                              }}
                              data-testid={`auto-remove-nonroster-select-${key}`}
                            />
                          </td>
                          <td className="p-2 font-mono text-fg-primary">
                            {s.groupEmail}
                            <span className="ml-2 text-fg-muted text-micro">
                              ({s.grade}-{s.class})
                            </span>
                          </td>
                          <td className="p-2 text-fg-primary">{s.memberEmail}</td>
                          <td className="p-2 font-mono text-fg-muted">{s.role}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {scanErrors.length > 0 && (
              <div
                className="border border-state-warning p-2 text-micro text-fg-secondary"
                data-testid="auto-remove-nonroster-scan-errors"
              >
                스캔 실패 (그룹 없음 or 권한): {scanErrors.map((e) => e.groupEmail).join(', ')}
              </div>
            )}
            {toRemove.length > 0 && (
              <div className="space-y-1">
                <label
                  htmlFor="auto-remove-nonroster-confirm-input"
                  className="text-small text-fg-primary"
                >
                  실행하려면 「제거 {toRemove.length}」 를 정확히 입력하세요:
                </label>
                <input
                  id="auto-remove-nonroster-confirm-input"
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  data-testid="auto-remove-nonroster-confirm-input"
                  className="w-64 border border-border-subtle bg-canvas px-3 py-2 text-body font-mono text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
                />
              </div>
            )}
          </>
        )}

        {phase === 'running' && (
          <div className="space-y-2" data-testid="auto-remove-nonroster-running">
            <p className="text-small text-fg-primary">
              제거 중... {progress} / {toRemove.length}
            </p>
            <div className="w-full h-2 bg-surface border border-border-subtle">
              <div
                className="h-full bg-fg-primary"
                style={{
                  width: `${toRemove.length > 0 ? (progress / toRemove.length) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        )}

        {phase === 'done' && (
          <div className="space-y-3" data-testid="auto-remove-nonroster-done">
            <p className="text-small text-fg-primary">
              완료: 성공 {results.filter((r) => r.kind === 'ok').length} / 실패{' '}
              {results.filter((r) => r.kind === 'failed').length}.
            </p>
            {results.some((r) => r.kind === 'failed') && (
              <div className="max-h-64 overflow-y-auto border border-state-danger">
                <table className="w-full text-small">
                  <thead className="bg-surface border-b border-border-subtle sticky top-0">
                    <tr>
                      <th scope="col" className="p-2 text-left">그룹</th>
                      <th scope="col" className="p-2 text-left">멤버</th>
                      <th scope="col" className="p-2 text-left">에러</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results
                      .filter((r) => r.kind === 'failed')
                      .map((r) => (
                        <tr
                          key={`${r.groupEmail}::${r.memberEmail}`}
                          className="border-b border-border-subtle last:border-0"
                        >
                          <td className="p-2 font-mono text-fg-primary">{r.groupEmail}</td>
                          <td className="p-2 text-fg-primary">{r.memberEmail}</td>
                          <td className="p-2 text-state-danger">{r.message}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {phase === 'confirm' && (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleOpenChange(false)}
              >
                취소
              </Button>
              <Button
                type="button"
                onClick={handleScan}
                disabled={!/^[a-z0-9-]+$/.test(prefix) || classSpecs.length === 0}
                data-testid="auto-remove-nonroster-scan-btn"
              >
                {classSpecs.length}개 그룹 스캔 시작
              </Button>
            </>
          )}
          {phase === 'scanning' && (
            <Button type="button" variant="secondary" disabled>
              스캔 중...
            </Button>
          )}
          {phase === 'preview' && (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPhase('confirm')}
              >
                뒤로
              </Button>
              <Button
                type="button"
                onClick={handleExecute}
                disabled={
                  toRemove.length === 0 || confirmText !== `제거 ${toRemove.length}`
                }
                data-testid="auto-remove-nonroster-execute-btn"
              >
                선택 {toRemove.length}건 제거 실행
              </Button>
            </>
          )}
          {phase === 'running' && (
            <Button type="button" variant="secondary" disabled>
              제거 중...
            </Button>
          )}
          {phase === 'done' && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleOpenChange(false)}
              data-testid="auto-remove-nonroster-close-btn"
            >
              닫기
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
