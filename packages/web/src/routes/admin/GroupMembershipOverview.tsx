import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/button';
import { Banner } from '../../components/Banner';
import { BulkProgress } from '../../components/BulkProgress';
import { ConfirmCountInput } from '../../components/ConfirmCountInput';
import { useGroupsList } from '../../api/groupsList';
import { useUsersList } from '../../api/usersList';
import { callGroupsMembersList } from '../../api/groupsMembersList';
import { callGroupsMembersDelete } from '../../api/groupsMembersDelete';
import { downloadCsv } from '../../lib/csvExport';

// v0.338: 원본 「그룹 배정 현황」 (fetchAllGroupAssignments) 포팅.
// 모든 그룹 × 멤버를 한 표로: 그룹 이름 · 그룹 이메일 · 멤버 이름 · 멤버 이메일 · 역할.
// 원본의 「그룹에서 삭제」 체크박스 → 선택 멤버십 일괄 제외 (건수 확인 관문).
// 그룹 수만큼 API 를 부르므로 화면을 열 때가 아니라 「불러오기」 를 눌렀을 때만 조회한다.

export interface MembershipRow {
  key: string;
  groupEmail: string;
  groupName: string;
  memberEmail: string;
  role: string;
  type: string;
}

interface LoadError {
  groupEmail: string;
  message: string;
}

const MAX_PAGES_PER_GROUP = 50;

export function membershipKey(groupEmail: string, memberEmail: string): string {
  return `${groupEmail}::${memberEmail}`;
}

export function GroupMembershipOverview() {
  const queryClient = useQueryClient();
  const groupsQuery = useGroupsList();
  const [loadRequested, setLoadRequested] = useState(false);
  const usersQuery = useUsersList(loadRequested);
  const [rows, setRows] = useState<MembershipRow[] | null>(null);
  const [errors, setErrors] = useState<LoadError[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmText, setConfirmText] = useState('');
  const [removing, setRemoving] = useState(false);
  const [removeProgress, setRemoveProgress] = useState(0);
  const [removeTotal, setRemoveTotal] = useState(0);
  const [removeFailures, setRemoveFailures] = useState<{ key: string; message: string }[]>([]);
  const [banner, setBanner] = useState<string | null>(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const nameByEmail = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of usersQuery.data?.users ?? []) m.set(u.email.toLowerCase(), `${u.lastName}${u.firstName}`.trim());
    return m;
  }, [usersQuery.data?.users]);

  const handleLoad = async () => {
    const groups = groupsQuery.data?.groups ?? [];
    setLoadRequested(true);
    setLoading(true);
    setBanner(null);
    setSelected(new Set());
    setConfirmText('');
    setRemoveFailures([]);
    setProgress(0);
    setTotal(groups.length);
    const out: MembershipRow[] = [];
    const errs: LoadError[] = [];
    for (let i = 0; i < groups.length; i++) {
      if (!aliveRef.current) return;
      const g = groups[i];
      try {
        let pageToken: string | undefined;
        let pages = 0;
        do {
          const res = await callGroupsMembersList({ groupEmail: g.email, pageToken, maxResults: 200 });
          for (const m of res.members ?? []) {
            out.push({
              key: membershipKey(g.email, m.email),
              groupEmail: g.email,
              groupName: g.name,
              memberEmail: m.email,
              role: m.role,
              type: m.type,
            });
          }
          pageToken = res.nextPageToken ?? undefined;
          pages++;
        } while (pageToken && pages < MAX_PAGES_PER_GROUP);
      } catch (e) {
        // 원본: 비공개 그룹 등 접근 실패는 「❌ 접근 실패」 행으로 남김.
        errs.push({ groupEmail: g.email, message: (e as Error).message });
      }
      setProgress(i + 1);
    }
    if (!aliveRef.current) return;
    setRows(out);
    setErrors(errs);
    setLoading(false);
  };

  const groupOptions = useMemo(
    () =>
      [...(groupsQuery.data?.groups ?? [])].sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, 'ko')),
    [groupsQuery.data?.groups],
  );

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (groupFilter && r.groupEmail !== groupFilter) return false;
      if (!q) return true;
      const name = nameByEmail.get(r.memberEmail.toLowerCase()) ?? '';
      return (
        r.groupEmail.toLowerCase().includes(q) ||
        r.groupName.toLowerCase().includes(q) ||
        r.memberEmail.toLowerCase().includes(q) ||
        name.toLowerCase().includes(q)
      );
    });
  }, [rows, search, groupFilter, nameByEmail]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.key));

  const handleExport = () => {
    downloadCsv(`group-memberships-${new Date().toISOString().split('T')[0]}.csv`, [
      ['그룹 이름', '그룹 이메일', '멤버 이름', '멤버 이메일', '역할', '유형'],
      ...filtered.map((r) => [
        r.groupName,
        r.groupEmail,
        nameByEmail.get(r.memberEmail.toLowerCase()) ?? '',
        r.memberEmail,
        r.role,
        r.type,
      ]),
    ]);
  };

  const handleRemove = async () => {
    if (!rows) return;
    // F99: 실행 시점 선택 snapshot.
    const targets = rows.filter((r) => selected.has(r.key));
    setRemoving(true);
    setRemoveTotal(targets.length);
    setRemoveProgress(0);
    setRemoveFailures([]);
    setBanner(null);
    const removed = new Set<string>();
    const failures: { key: string; message: string }[] = [];
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      try {
        await callGroupsMembersDelete({ groupEmail: t.groupEmail, memberEmail: t.memberEmail });
        removed.add(t.key);
      } catch (e) {
        failures.push({ key: t.key, message: (e as Error).message });
      }
      setRemoveProgress(i + 1);
    }
    if (!aliveRef.current) return;
    setRows((prev) => (prev ? prev.filter((r) => !removed.has(r.key)) : prev));
    setSelected((prev) => new Set([...prev].filter((k) => !removed.has(k))));
    setConfirmText('');
    setRemoveFailures(failures);
    setRemoving(false);
    setBanner(`${removed.size}건을 그룹에서 제외했습니다.${failures.length ? ` (실패 ${failures.length}건)` : ''}`);
    queryClient.invalidateQueries({ queryKey: ['groups'] });
  };

  const busy = loading || removing;

  return (
    <div className="space-y-4" data-testid="group-memberships">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-small text-fg-secondary">
          모든 그룹의 멤버를 한 표로 봅니다. 그룹 {groupsQuery.data?.groups.length ?? 0}개를 차례로 조회하므로 시간이 걸릴 수 있어요.
        </p>
        <div className="flex gap-2">
          <Button onClick={handleLoad} disabled={busy || !groupsQuery.data} data-testid="group-memberships-load">
            {rows ? '다시 불러오기' : '불러오기'}
          </Button>
          <Button variant="secondary" onClick={handleExport} disabled={busy || filtered.length === 0} data-testid="group-memberships-csv">
            CSV 내보내기 ({filtered.length})
          </Button>
        </div>
      </div>

      {loading && <BulkProgress progress={progress} total={total} testId="group-memberships-loading" label="그룹 조회 중:" />}
      <Banner variant="success" message={banner} testId="group-memberships-banner" />
      {errors.length > 0 && (
        <Banner
          variant="warning"
          message={`접근하지 못한 그룹 ${errors.length}개: ${errors
            .slice(0, 5)
            .map((e) => `${e.groupEmail} (${e.message})`)
            .join(', ')}${errors.length > 5 ? ' …' : ''}`}
          testId="group-memberships-errors"
        />
      )}

      {rows && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="그룹 · 멤버 이름 · 이메일 검색"
              aria-label="그룹 배정 현황 검색"
              data-testid="group-memberships-search"
              className="w-72 border border-border-subtle bg-canvas px-3 py-2 text-small text-fg-primary"
            />
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              aria-label="그룹 필터"
              data-testid="group-memberships-group-filter"
              className="border border-border-subtle bg-canvas px-3 py-2 text-small text-fg-primary"
            >
              <option value="">전체 그룹</option>
              {groupOptions.map((g) => (
                <option key={g.email} value={g.email}>
                  {g.name || g.email}
                </option>
              ))}
            </select>
            <span className="text-small text-fg-muted" data-testid="group-memberships-count">
              {filtered.length} / {rows.length}건
            </span>
          </div>

          {selected.size > 0 && (
            <div className="border border-border-strong bg-surface p-4 space-y-2" data-testid="group-memberships-remove-bar">
              <p className="text-small text-fg-primary">
                <strong className="font-mono">{selected.size}</strong>건 선택 — 선택한 멤버를 해당 그룹에서 제외합니다.
              </p>
              <ConfirmCountInput
                expectedCount={selected.size}
                value={confirmText}
                onChange={setConfirmText}
                idPrefix="group-memberships-remove"
                disabled={busy}
              />
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setSelected(new Set())} disabled={busy}>
                  선택 해제
                </Button>
                <Button
                  className="text-state-danger"
                  variant="secondary"
                  onClick={handleRemove}
                  disabled={busy || confirmText.trim() !== String(selected.size)}
                  data-testid="group-memberships-remove"
                >
                  {selected.size}건 그룹에서 제외
                </Button>
              </div>
              {removing && (
                <BulkProgress progress={removeProgress} total={removeTotal} testId="group-memberships-removing" label="제외 중:" />
              )}
            </div>
          )}
          {removeFailures.length > 0 && (
            <Banner
              variant="error"
              message={`제외 실패 ${removeFailures.length}건: ${removeFailures
                .slice(0, 5)
                .map((f) => `${f.key.replace('::', ' → ')} (${f.message})`)
                .join(', ')}`}
              testId="group-memberships-remove-failures"
            />
          )}

          <div className="border border-border-subtle overflow-x-auto max-h-[32rem] overflow-y-auto">
            <table className="w-full text-small" aria-label="그룹 배정 현황" data-testid="group-memberships-table">
              <thead className="bg-elevated text-fg-secondary sticky top-0">
                <tr>
                  <th scope="col" className="p-2 w-8">
                    <input
                      type="checkbox"
                      aria-label="보이는 행 전체 선택"
                      checked={allFilteredSelected}
                      disabled={busy || filtered.length === 0}
                      onChange={() =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (allFilteredSelected) filtered.forEach((r) => next.delete(r.key));
                          else filtered.forEach((r) => next.add(r.key));
                          return next;
                        })
                      }
                      data-testid="group-memberships-select-all"
                    />
                  </th>
                  <th scope="col" className="p-2 text-left font-normal">그룹 이름</th>
                  <th scope="col" className="p-2 text-left font-normal">그룹 이메일</th>
                  <th scope="col" className="p-2 text-left font-normal">멤버 이름</th>
                  <th scope="col" className="p-2 text-left font-normal">멤버 이메일</th>
                  <th scope="col" className="p-2 text-left font-normal">역할</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.key} className="border-t border-border-subtle">
                    <td className="p-2">
                      <input
                        type="checkbox"
                        aria-label={`${r.groupEmail} 의 ${r.memberEmail} 선택`}
                        checked={selected.has(r.key)}
                        disabled={busy}
                        onChange={() => {
                          setConfirmText('');
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(r.key)) next.delete(r.key);
                            else next.add(r.key);
                            return next;
                          });
                        }}
                        data-testid={`group-memberships-cb-${r.key}`}
                      />
                    </td>
                    <td className="p-2 text-fg-primary">{r.groupName}</td>
                    <td className="p-2 font-mono text-fg-secondary">{r.groupEmail}</td>
                    <td className="p-2 text-fg-primary">{nameByEmail.get(r.memberEmail.toLowerCase()) ?? ''}</td>
                    <td className="p-2 font-mono text-fg-secondary">{r.memberEmail}</td>
                    <td className="p-2 text-fg-secondary">{r.role}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-fg-muted">
                      표시할 멤버가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
