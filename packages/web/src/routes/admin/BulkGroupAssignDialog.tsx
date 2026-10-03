import { useMemo, useState } from 'react';
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
import { Banner } from '../../components/Banner';
import { BulkProgress } from '../../components/BulkProgress';
import { PreviewList } from '../../components/PreviewList';
import { BulkDoneSummary } from '../../components/BulkDoneSummary';
import { BulkFailureList } from '../../components/BulkFailureList';
import { ConfirmCountInput } from '../../components/ConfirmCountInput';
import { SrOnlyDialogHeader } from '../../components/SrOnlyDialogHeader';
import { useBulkDialogPhase } from '../../lib/useBulkDialogPhase';
import { useGroupsList } from '../../api/groupsList';
import { callGroupsMembersInsert } from '../../api/groupsMembersInsert';
import { callGroupsMembersDelete } from '../../api/groupsMembersDelete';

export interface BulkGroupAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emails: string[];
  onDone?: () => void;
}

type Action = 'assign' | 'remove';

interface Failure {
  key: string;
  email: string;
  groupEmail: string;
  message: string;
}

// v0.332: 원본 「그룹 배정 및 제외」 (assignGroups) 포팅 — 선택한 계정들을 고른 그룹들에
// 한 번에 배정 (Members.insert) 또는 제외 (Members.remove). 원본은 행마다 그룹 1~3 + 배정/삭제
// 열이었지만, 웹에서는 계정 목록 체크 → 그룹 여러 개 체크 → 배정/제외 한 번으로.
// 제외는 파괴적이라 대상 건수 정확 입력 관문 (F99 snapshot · ConfirmCountInput 규약).
export function BulkGroupAssignDialog({ open, onOpenChange, emails, onDone }: BulkGroupAssignDialogProps) {
  const queryClient = useQueryClient();
  const groupsQuery = useGroupsList(open);
  const [action, setAction] = useState<Action>('assign');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [failures, setFailures] = useState<Failure[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [runAction, setRunAction] = useState<Action>('assign');

  const { phase, setPhase, handleOpenChange } = useBulkDialogPhase({
    open,
    onOpenChange,
    onDone,
    onOpen: () => {
      setAction('assign');
      setSelected(new Set());
      setSearch('');
      setConfirmText('');
      setProgress(0);
      setTotal(0);
      setFailures([]);
      setSkipped(0);
    },
  });

  const groups = useMemo(
    () =>
      [...(groupsQuery.data?.groups ?? [])].sort((a, b) =>
        (a.name || a.email).localeCompare(b.name || b.email, 'ko'),
      ),
    [groupsQuery.data?.groups],
  );
  const visible = groups.filter((g) => {
    const q = search.trim().toLowerCase();
    return !q || g.email.toLowerCase().includes(q) || (g.name || '').toLowerCase().includes(q);
  });
  const pairCount = emails.length * selected.size;
  const needsConfirm = action === 'remove';
  const canRun =
    emails.length > 0 && selected.size > 0 && (!needsConfirm || confirmText.trim() === String(pairCount));

  const handleRun = async () => {
    // F99: 계정 · 그룹 · 동작 snapshot.
    const emailSnap = [...emails];
    const groupSnap = Array.from(selected);
    const act = action;
    setRunAction(act);
    setTotal(emailSnap.length * groupSnap.length);
    setProgress(0);
    setPhase('running');
    const localFailures: Failure[] = [];
    let localSkipped = 0;
    let done = 0;
    for (const groupEmail of groupSnap) {
      for (const email of emailSnap) {
        try {
          if (act === 'assign') {
            await callGroupsMembersInsert({ groupEmail, memberEmail: email, role: 'MEMBER' });
          } else {
            await callGroupsMembersDelete({ groupEmail, memberEmail: email });
          }
        } catch (e) {
          const message = (e as Error).message;
          // 이미 멤버 (배정 · Google 「Member already exists」) · 멤버 아님 (제외 · 「Resource Not Found」)
          // 은 목표 상태와 같으므로 skip 으로 집계. 그룹은 목록에서 고르므로 그룹 자체 404 는 사실상 없음.
          if (
            (act === 'assign' && /already|duplicate|409|member_exists/i.test(message)) ||
            (act === 'remove' && /not.?found|404|resource_not_found/i.test(message))
          ) {
            localSkipped++;
          } else {
            localFailures.push({ key: `${groupEmail}::${email}`, email, groupEmail, message });
          }
        }
        done++;
        setProgress(done);
      }
    }
    setFailures(localFailures);
    setSkipped(localSkipped);
    setPhase('done');
    queryClient.invalidateQueries({ queryKey: ['groups'] });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={phase === 'running' ? '[&>button]:hidden max-w-2xl' : 'max-w-2xl'}>
        {phase === 'confirm' && (
          <>
            <DialogHeader>
              <DialogTitle>그룹 배정 · 제외</DialogTitle>
              <DialogDescription>
                선택한 {emails.length}명을 아래에서 고른 그룹에 한 번에 배정하거나 제외합니다.
              </DialogDescription>
            </DialogHeader>
            <PreviewList items={emails} getKey={(e) => e} renderItem={(e) => e} unit="명" />

            <fieldset className="flex items-center gap-4">
              <legend className="text-small text-fg-primary mb-1">동작</legend>
              <label className="flex items-center gap-2 text-small text-fg-primary">
                <input
                  type="radio"
                  name="bulk-group-action"
                  checked={action === 'assign'}
                  onChange={() => {
                    setAction('assign');
                    setConfirmText('');
                  }}
                  data-testid="bulk-group-action-assign"
                />
                배정 (그룹에 추가)
              </label>
              <label className="flex items-center gap-2 text-small text-fg-primary">
                <input
                  type="radio"
                  name="bulk-group-action"
                  checked={action === 'remove'}
                  onChange={() => {
                    setAction('remove');
                    setConfirmText('');
                  }}
                  data-testid="bulk-group-action-remove"
                />
                제외 (그룹에서 빼기)
              </label>
            </fieldset>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-small text-fg-primary">
                  그룹 선택 — <strong>{selected.size}</strong>개
                  {groupsQuery.isLoading && <span className="ml-2 text-fg-muted">불러오는 중...</span>}
                </span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="그룹 검색"
                  aria-label="그룹 검색"
                  data-testid="bulk-group-search"
                  className="w-48 border border-border-subtle bg-canvas px-2 py-1 text-small text-fg-primary"
                />
              </div>
              <Banner
                variant="error"
                message={groupsQuery.isError ? `그룹 목록 로드 실패: ${groupsQuery.error?.message}` : null}
                testId="bulk-group-list-error"
              />
              <div
                className="max-h-56 overflow-y-auto border border-border-subtle p-2 grid grid-cols-1 md:grid-cols-2 gap-1"
                data-testid="bulk-group-list"
              >
                {visible.map((g) => (
                  <label key={g.email} className="flex items-center gap-2 text-small text-fg-primary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.has(g.email)}
                      onChange={() => {
                        setConfirmText('');
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (next.has(g.email)) next.delete(g.email);
                          else next.add(g.email);
                          return next;
                        });
                      }}
                      data-testid={`bulk-group-cb-${g.email}`}
                    />
                    <span className="truncate" title={g.email}>
                      {g.name || g.email}
                    </span>
                  </label>
                ))}
                {!groupsQuery.isLoading && visible.length === 0 && (
                  <p className="text-small text-fg-muted">일치하는 그룹이 없습니다.</p>
                )}
              </div>
            </div>

            <p className="text-small text-fg-secondary" data-testid="bulk-group-pair-count">
              {emails.length}명 × {selected.size}개 그룹 = <strong>{pairCount}</strong>건{' '}
              {action === 'assign' ? '배정' : '제외'}
            </p>
            {needsConfirm && pairCount > 0 && (
              <ConfirmCountInput
                expectedCount={pairCount}
                value={confirmText}
                onChange={setConfirmText}
                idPrefix="bulk-group-remove"
              />
            )}

            <DialogFooter>
              <Button variant="secondary" onClick={() => handleOpenChange(false)}>
                취소
              </Button>
              <Button
                onClick={handleRun}
                disabled={!canRun}
                className={action === 'remove' ? 'text-state-danger' : undefined}
                data-testid="bulk-group-run"
              >
                {pairCount}건 {action === 'assign' ? '배정' : '제외'}
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === 'running' && (
          <>
            <SrOnlyDialogHeader title="그룹 배정 · 제외 진행 중" description="그룹 멤버를 변경하고 있습니다." />
            <BulkProgress progress={progress} total={total} testId="bulk-group-running" />
          </>
        )}

        {phase === 'done' && (
          <>
            <SrOnlyDialogHeader title="그룹 배정 · 제외 완료" description="작업이 끝났습니다." />
            <div className="space-y-3" data-testid="bulk-group-done">
              <BulkDoneSummary
                successCount={total - failures.length - skipped}
                failureCount={failures.length}
                skippedCount={skipped}
                skippedSuffix={runAction === 'assign' ? '이미 멤버 (skip)' : '멤버 아님 (skip)'}
                unit="건"
                label={runAction === 'assign' ? '배정 완료:' : '제외 완료:'}
              />
              <BulkFailureList
                items={failures}
                getKey={(f) => f.key}
                renderItem={(f) => (
                  <>
                    <span className="font-mono">{f.email}</span> → <span className="font-mono">{f.groupEmail}</span>: {f.message}
                  </>
                )}
                testId="bulk-group-failures"
              />
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
