// v0.150: 반 챗방에 rosters 학생 자동 초대 (원본 Apps Script
// `assignMembersToChatRooms` 대응). 학년/반 → chat space displayName 매칭 →
// 각 space 에 rosters 학생 순차 add.
//
// 대칭:
// - 그룹: AutoInviteStudentsDialog (v0.119 이전) · AutoRemoveNonRosterMembersDialog (v0.149).
// - 챗방: 이 다이얼로그 (add 만). remove 는 v0.151+ 로 유보.

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
import { Banner } from '../../components/Banner';
import { callChatList, type ChatSpaceItem } from '../../api/chatList';
import { callChatMembersAdd } from '../../api/chatMembersAdd';
import { courseName, isAlreadyExistsError } from './CourseBulkCreateDialog';

export interface AutoInviteStudentsToChatSpacesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
  data: BasicDataYear;
  onDone?: () => void;
}

type Phase = 'confirm' | 'scanning' | 'preview' | 'running' | 'done';

interface MatchedTarget {
  grade: number;
  class: string;
  displayName: string; // "2026학년도 1학년 1반"
  spaceName: string; // "spaces/AAAA"
  students: string[]; // rosters emails
}

interface UnmatchedEntry {
  grade: number;
  class: string;
  displayName: string;
}

type ResultKind = 'ok' | 'skipped' | 'failed';
interface InviteResult {
  spaceName: string;
  displayName: string;
  memberEmail: string;
  kind: ResultKind;
  message?: string;
}

// v0.150: displayName 은 CourseBulkCreateDialog.courseName 과 동일 규칙 사용
// (학년/반 챗방을 학급 통합 생성 시 만든 이름 규칙에 맞춤).
export function buildTargetDisplayName(year: number, grade: number, cls: string): string {
  return courseName(year, grade, cls);
}

export function AutoInviteStudentsToChatSpacesDialog({
  open,
  onOpenChange,
  year,
  data,
  onDone,
}: AutoInviteStudentsToChatSpacesDialogProps) {
  const queryClient = useContext(QueryClientContext);
  const [phase, setPhase] = useState<Phase>('confirm');
  const [confirmText, setConfirmText] = useState('');
  const [matched, setMatched] = useState<MatchedTarget[]>([]);
  const [unmatched, setUnmatched] = useState<UnmatchedEntry[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [totalTargets, setTotalTargets] = useState(0);
  const [results, setResults] = useState<InviteResult[]>([]);

  // 학년/반 명단이 등록된 조합만 대상.
  const classSpecs = useMemo(() => {
    const out: { grade: number; class: string; displayName: string; students: string[] }[] = [];
    for (const g of data?.grades ?? []) {
      for (const c of g?.classes ?? []) {
        const students = data?.rosters?.[String(g.grade)]?.[c];
        if (students === undefined || students.length === 0) continue;
        out.push({
          grade: g.grade,
          class: c,
          displayName: buildTargetDisplayName(year, g.grade, c),
          students,
        });
      }
    }
    return out;
  }, [data, year]);

  useEffect(() => {
    if (open) {
      setPhase('confirm');
      setConfirmText('');
      setMatched([]);
      setUnmatched([]);
      setScanError(null);
      setProgress(0);
      setTotalTargets(0);
      setResults([]);
    }
  }, [open]);

  const handleOpenChange = (next: boolean) => {
    if (phase === 'scanning' || phase === 'running') return;
    onOpenChange(next);
  };

  const handleScan = async () => {
    setPhase('scanning');
    setScanError(null);
    try {
      const res = await callChatList();
      const byDisplay = new Map<string, ChatSpaceItem>();
      for (const s of res.spaces) {
        if (typeof s.displayName === 'string' && s.displayName.trim().length > 0) {
          byDisplay.set(s.displayName.trim(), s);
        }
      }
      const matchedOut: MatchedTarget[] = [];
      const unmatchedOut: UnmatchedEntry[] = [];
      for (const spec of classSpecs) {
        const space = byDisplay.get(spec.displayName);
        if (space?.name) {
          matchedOut.push({
            grade: spec.grade,
            class: spec.class,
            displayName: spec.displayName,
            spaceName: space.name,
            students: spec.students,
          });
        } else {
          unmatchedOut.push({
            grade: spec.grade,
            class: spec.class,
            displayName: spec.displayName,
          });
        }
      }
      setMatched(matchedOut);
      setUnmatched(unmatchedOut);
      setTotalTargets(matchedOut.reduce((n, m) => n + m.students.length, 0));
      setPhase('preview');
    } catch (e) {
      setScanError(e instanceof Error ? e.message : String(e));
      setPhase('confirm');
    }
  };

  const handleExecute = async () => {
    if (confirmText !== `초대 ${totalTargets}`) return;
    setPhase('running');
    setProgress(0);
    const collected: InviteResult[] = [];
    let done = 0;
    for (const m of matched) {
      for (const email of m.students) {
        try {
          await callChatMembersAdd({ spaceName: m.spaceName, email });
          collected.push({
            spaceName: m.spaceName,
            displayName: m.displayName,
            memberEmail: email,
            kind: 'ok',
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          collected.push({
            spaceName: m.spaceName,
            displayName: m.displayName,
            memberEmail: email,
            kind: isAlreadyExistsError(message) ? 'skipped' : 'failed',
            message,
          });
        }
        done += 1;
        setProgress(done);
      }
    }
    setResults(collected);
    queryClient?.invalidateQueries({ queryKey: ['chat', 'members'] });
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
              <DialogTitle>반 챗방에 학생 자동 초대</DialogTitle>
              <DialogDescription>
                {year}년 rosters 기준 {classSpecs.length}개 반 명단을 각 반 챗방
                (「{year}학년도 N학년 M반」 displayName 매칭) 에 순차 초대합니다.
                원본 Apps Script `assignMembersToChatRooms` 대응.
              </DialogDescription>
            </DialogHeader>
            <p
              className="text-small text-fg-secondary"
              data-testid="auto-invite-chat-scan-summary"
            >
              스캔 대상: {classSpecs.length}개 반 (rosters 명단 있는 것만).
            </p>
            {scanError && (
              <p
                className="text-small text-state-danger"
                data-testid="auto-invite-chat-scan-error"
              >
                스캔 실패: {scanError}
              </p>
            )}
          </>
        )}

        {phase === 'scanning' && (
          <div className="space-y-2" data-testid="auto-invite-chat-scanning">
            <p className="text-small text-fg-primary">
              챗방 목록 스캔 중...
            </p>
            <div className="w-full h-2 bg-surface border border-border-subtle overflow-hidden">
              <div className="h-full bg-fg-primary animate-pulse w-1/2" />
            </div>
          </div>
        )}

        {phase === 'preview' && (
          <>
            <DialogHeader>
              <DialogTitle>초대 계획 미리보기</DialogTitle>
              <DialogDescription>
                매칭된 챗방 {matched.length}개 · 총 초대 대상 {totalTargets}명 학생.
                {unmatched.length > 0 && ` 챗방 미매칭 ${unmatched.length}건 (아래 확인).`}
              </DialogDescription>
            </DialogHeader>
            {matched.length > 0 ? (
              <div
                className="max-h-64 overflow-y-auto border border-border-subtle bg-canvas"
                data-testid="auto-invite-chat-matched-table"
              >
                <table className="w-full text-small">
                  <thead className="bg-surface border-b border-border-subtle sticky top-0">
                    <tr>
                      <th scope="col" className="p-2 text-left">챗방 이름</th>
                      <th scope="col" className="p-2 text-left">학년-반</th>
                      <th scope="col" className="p-2 text-right">초대 학생</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matched.map((m) => (
                      <tr
                        key={m.spaceName}
                        className="border-b border-border-subtle last:border-0"
                        data-testid={`auto-invite-chat-matched-${m.spaceName}`}
                      >
                        <td className="p-2 text-fg-primary">{m.displayName}</td>
                        <td className="p-2 font-mono text-fg-muted">
                          {m.grade}-{m.class}
                        </td>
                        <td className="p-2 text-right font-mono">{m.students.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p
                className="text-small text-fg-muted py-6 text-center"
                data-testid="auto-invite-chat-matched-empty"
              >
                매칭된 챗방이 없습니다. 「학급 통합 생성」 으로 챗방을 먼저 만드세요.
              </p>
            )}
            {/* v0.252: Banner 이식 (bodyClass 로 p-2 + max-h/overflow + 자식 색상 유지). */}
            <Banner
              variant="warning"
              message={
                unmatched.length > 0 ? (
                  <>
                    <p className="text-fg-primary font-medium">
                      챗방이 없는 반 ({unmatched.length}건, skip):
                    </p>
                    <ul className="text-micro text-fg-secondary font-mono list-disc pl-4">
                      {unmatched.map((u) => (
                        <li key={`${u.grade}-${u.class}`}>{u.displayName}</li>
                      ))}
                    </ul>
                  </>
                ) : null
              }
              testId="auto-invite-chat-unmatched"
              bodyClass="p-2 space-y-1 max-h-40 overflow-y-auto"
            />

            {totalTargets > 0 && (
              <div className="space-y-1">
                <label
                  htmlFor="auto-invite-chat-confirm-input"
                  className="text-small text-fg-primary"
                >
                  실행하려면 「초대 {totalTargets}」 를 정확히 입력하세요:
                </label>
                <input
                  id="auto-invite-chat-confirm-input"
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  data-testid="auto-invite-chat-confirm-input"
                  className="w-64 border border-border-subtle bg-canvas px-3 py-2 text-body font-mono text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
                />
              </div>
            )}
          </>
        )}

        {phase === 'running' && (
          <div className="space-y-2" data-testid="auto-invite-chat-running">
            <p className="text-small text-fg-primary">
              초대 중... {progress} / {totalTargets}
            </p>
            <div className="w-full h-2 bg-surface border border-border-subtle">
              <div
                className="h-full bg-fg-primary"
                style={{
                  width: `${totalTargets > 0 ? (progress / totalTargets) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        )}

        {phase === 'done' && (
          <div className="space-y-3" data-testid="auto-invite-chat-done">
            <p className="text-small text-fg-primary">
              완료: 성공 {results.filter((r) => r.kind === 'ok').length} · 이미 멤버 (skip){' '}
              {results.filter((r) => r.kind === 'skipped').length} · 실패{' '}
              {results.filter((r) => r.kind === 'failed').length}.
            </p>
            {results.some((r) => r.kind === 'failed') && (
              <div className="max-h-64 overflow-y-auto border border-state-danger">
                <table className="w-full text-small">
                  <thead className="bg-surface border-b border-border-subtle sticky top-0">
                    <tr>
                      <th scope="col" className="p-2 text-left">챗방</th>
                      <th scope="col" className="p-2 text-left">학생</th>
                      <th scope="col" className="p-2 text-left">에러</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results
                      .filter((r) => r.kind === 'failed')
                      .map((r, i) => (
                        <tr
                          key={`${r.spaceName}::${r.memberEmail}::${i}`}
                          className="border-b border-border-subtle last:border-0"
                        >
                          <td className="p-2 text-fg-primary">{r.displayName}</td>
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
                disabled={classSpecs.length === 0}
                data-testid="auto-invite-chat-scan-btn"
              >
                {classSpecs.length}개 반 스캔 시작
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
                  totalTargets === 0 || confirmText !== `초대 ${totalTargets}`
                }
                data-testid="auto-invite-chat-execute-btn"
              >
                {totalTargets}건 초대 실행
              </Button>
            </>
          )}
          {phase === 'running' && (
            <Button type="button" variant="secondary" disabled>
              초대 중...
            </Button>
          )}
          {phase === 'done' && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleOpenChange(false)}
              data-testid="auto-invite-chat-close-btn"
            >
              닫기
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
