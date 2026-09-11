import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { callUsersCreate } from "../../api/usersCreate";
import { useOrgunitsList } from "../../api/orgunitsList";

export interface BatchCreateUsersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// v0.132: 전입생 일괄 계정 생성. bliss00 지시 사양:
// - 10 rows: 아이디 · 성 · 이름 만 입력 → 이메일 = `<id>@cam.hs.kr` 자동.
// - 공통 필드: OU + 초기 비밀번호 + 첫 로그인 시 변경 강제.
// - 3-phase (confirm → running → done + 부분 실패 목록) — Bulk* 다이얼로그 패턴.
const MAX_ROWS = 10;
const DOMAIN = "cam.hs.kr";
// 아이디 규칙: Google Workspace 사용자 이름 (local-part) 는 알파벳/숫자/`.`/`_`/`-` 만.
// 대소문자는 서버가 정규화하지만 표시 목적상 그대로 유지. `@` 금지 (도메인 자동).
const LOCAL_PART_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

type Phase = "confirm" | "running" | "done";

interface RowInput {
  id: string;
  familyName: string;
  givenName: string;
}

interface RowResult {
  primaryEmail: string;
  ok: boolean;
  message?: string;
}

function emptyRow(): RowInput {
  return { id: "", familyName: "", givenName: "" };
}

function makeInitialRows(): RowInput[] {
  return Array.from({ length: MAX_ROWS }, emptyRow);
}

// v0.132c F109: snapshot 구성을 순수 함수로 분리해서 직접 회귀 가능.
// (input rows 배열을 mutation 해도 반환값이 영향받지 않음을 검증.)
export interface RunRowSnapshot {
  primaryEmail: string;
  givenName: string;
  familyName: string;
}

export function buildRunRowsSnapshot(rows: RowInput[], domain: string): RunRowSnapshot[] {
  return rows
    .map((r) => ({
      id: r.id.trim(),
      familyName: r.familyName.trim(),
      givenName: r.givenName.trim(),
    }))
    .filter((r) => r.id !== "" || r.familyName !== "" || r.givenName !== "")
    .map((r) => ({
      primaryEmail: `${r.id.toLowerCase()}@${domain}`,
      givenName: r.givenName,
      familyName: r.familyName,
    }));
}

export function BatchCreateUsersDialog({ open, onOpenChange }: BatchCreateUsersDialogProps) {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>("confirm");
  const [rows, setRows] = useState<RowInput[]>(makeInitialRows);
  const [orgUnitPath, setOrgUnitPath] = useState("/");
  const [initialPassword, setInitialPassword] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<RowResult[]>([]);
  // v0.132 (== v0.124 F99 대칭): confirm 시점 snapshot. 실행 중 사용자가 위 폼
  // 을 조작해도 원래 승인 대상 == 처리 대상.
  const [runRows, setRunRows] = useState<RunRowSnapshot[] | null>(null);

  const orgunitsQuery = useOrgunitsList(open);

  useEffect(() => {
    if (open) {
      setPhase("confirm");
      setRows(makeInitialRows());
      setOrgUnitPath("/");
      setInitialPassword("");
      setValidationError(null);
      setProgress(0);
      setResults([]);
      setRunRows(null);
    }
  }, [open]);

  const handleOpenChange = (newOpen: boolean) => {
    // 실행 중 X · Escape · outside 로 닫히지 않게 gate.
    if (phase === "running") return;
    onOpenChange(newOpen);
  };

  const updateRow = (i: number, patch: Partial<RowInput>) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };

  // 유효 (fully filled + local part OK) row 만 집계.
  type FilledRow = RowInput & { primaryEmail: string };
  const filledRows: FilledRow[] = rows
    .map((r) => ({
      id: r.id.trim(),
      familyName: r.familyName.trim(),
      givenName: r.givenName.trim(),
    }))
    .filter((r) => r.id !== "" || r.familyName !== "" || r.givenName !== "")
    // v0.132b F107: primaryEmail 은 lower-case canonical. Google Workspace 는
    // 이메일을 lower-case 로 저장하며, 서버·AccountsTable 도 lower 비교 사용.
    .map((r) => ({ ...r, primaryEmail: `${r.id.toLowerCase()}@${DOMAIN}` }));

  const handleConfirm = async () => {
    setValidationError(null);
    if (filledRows.length === 0) {
      setValidationError("최소 1명 이상 입력해주세요.");
      return;
    }
    // 각 filled row 유효성.
    for (const r of filledRows) {
      if (!r.id) return setValidationError(`아이디를 입력해주세요.`);
      if (!LOCAL_PART_RE.test(r.id))
        return setValidationError(
          `아이디 「${r.id}」 는 사용할 수 없습니다. 알파벳/숫자/./-/_ 만 허용, 최대 64자.`,
        );
      if (!r.familyName) return setValidationError(`「${r.id}」 의 성을 입력해주세요.`);
      if (!r.givenName) return setValidationError(`「${r.id}」 의 이름을 입력해주세요.`);
    }
    // v0.132b F107: 중복 아이디 검사는 lower-case canonical 로. Google
    // Workspace 이메일 비교는 대소문자 무시 (`Hong1@` == `hong1@`), 앱의
    // AccountsTable 도 lower 비교라 여기서도 대소문자 무시로 통일.
    const idSet = new Set<string>();
    for (const r of filledRows) {
      const canonical = r.id.toLowerCase();
      if (idSet.has(canonical))
        return setValidationError(`아이디 「${r.id}」 가 중복됩니다 (대소문자 무시).`);
      idSet.add(canonical);
    }
    if (!initialPassword || initialPassword.length < 8)
      return setValidationError("초기 비밀번호는 최소 8자 이상이어야 합니다.");
    const orgu = orgUnitPath.trim() || "/";

    // F99 / v0.132c F109: snapshot 은 buildRunRowsSnapshot 로 확정. rows 인풋을
    // 직접 spread 해서 정규화 · 필터 · lower-case 정규화를 한 번에 (순수 함수라
    // 별도 회귀 가능).
    const snapshot = buildRunRowsSnapshot(rows, DOMAIN);
    setRunRows(snapshot);
    setPhase("running");
    setProgress(0);

    const localResults: RowResult[] = [];
    const passwordForRun = initialPassword;
    // 실행 시작 즉시 password state 는 clear (BulkResetPassword v0.113b F65 패턴).
    setInitialPassword("");

    for (let i = 0; i < snapshot.length; i++) {
      const row = snapshot[i];
      try {
        await callUsersCreate({
          primaryEmail: row.primaryEmail,
          givenName: row.givenName,
          familyName: row.familyName,
          password: passwordForRun,
          orgUnitPath: orgu,
          changePasswordAtNextLogin: true,
        });
        localResults.push({ primaryEmail: row.primaryEmail, ok: true });
      } catch (e) {
        localResults.push({
          primaryEmail: row.primaryEmail,
          ok: false,
          message: (e as Error).message,
        });
      }
      setProgress(i + 1);
    }
    setResults(localResults);
    setPhase("done");
    queryClient.invalidateQueries({ queryKey: ["users", "list"] });
  };

  const displayRows = runRows ?? filledRows.map((r) => ({
    primaryEmail: r.primaryEmail,
    givenName: r.givenName,
    familyName: r.familyName,
  }));

  const successCount = results.filter((r) => r.ok).length;
  const failCount = results.length - successCount;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={phase === "running" ? "[&>button]:hidden max-w-3xl" : "max-w-3xl"}>
        {phase === "confirm" && (
          <>
            <DialogHeader>
              <DialogTitle>전입생 일괄 계정 추가</DialogTitle>
              <DialogDescription>
                최대 <strong>{MAX_ROWS}</strong>명까지 한 번에 등록. 아이디만 입력하면 이메일은
                <span className="font-mono"> @{DOMAIN}</span> 로 자동 부착됩니다. 초기 비밀번호는
                모두 같은 값으로 설정되며 첫 로그인 시 변경이 강제됩니다.
              </DialogDescription>
            </DialogHeader>

            {validationError && (
              <div
                className="border border-state-danger p-3 text-small text-state-danger"
                data-testid="batch-create-users-error"
              >
                {validationError}
              </div>
            )}

            {/* 공통 필드 */}
            <div className="space-y-3 border border-border-subtle p-3 bg-elevated">
              <div>
                <label
                  htmlFor="batch-create-users-orgunit"
                  className="text-small text-fg-secondary mb-1 block"
                >
                  조직 단위 (모두 공통)
                  {orgunitsQuery.isLoading && (
                    <span className="text-fg-muted ml-2">불러오는 중...</span>
                  )}
                  {orgunitsQuery.isError && (
                    <span
                      className="text-state-danger ml-2"
                      data-testid="batch-create-users-orgunits-error"
                    >
                      OU 목록 로드 실패
                    </span>
                  )}
                </label>
                <input
                  id="batch-create-users-orgunit"
                  type="text"
                  value={orgUnitPath}
                  onChange={(e) => setOrgUnitPath(e.target.value)}
                  placeholder="/학생/1학년"
                  list="batch-create-users-orgunits-list"
                  data-testid="batch-create-users-orgunit-input"
                  className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
                />
                <datalist
                  id="batch-create-users-orgunits-list"
                  data-testid="batch-create-users-orgunits-datalist"
                >
                  {(orgunitsQuery.data?.orgUnits ?? []).map((ou) => (
                    <option key={ou.orgUnitPath} value={ou.orgUnitPath}>
                      {ou.name ? `${ou.orgUnitPath} — ${ou.name}` : ou.orgUnitPath}
                    </option>
                  ))}
                </datalist>
              </div>

              <div>
                <label
                  htmlFor="batch-create-users-password"
                  className="text-small text-fg-secondary mb-1 block"
                >
                  초기 비밀번호 (모두 공통, 8자 이상)
                </label>
                <input
                  id="batch-create-users-password"
                  type="password"
                  value={initialPassword}
                  onChange={(e) => setInitialPassword(e.target.value)}
                  placeholder="8자 이상 · 첫 로그인 시 변경 강제"
                  data-testid="batch-create-users-password-input"
                  className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
                />
              </div>
            </div>

            {/* 10 rows */}
            <div className="border border-border-subtle overflow-hidden" data-testid="batch-create-users-rows">
              {/* v0.132b F108: scope="col" 로 th 정확 마크. 각 input 은 row
                  번호 포함 aria-label 로 프로그램적 접근 이름 부여
                  (row 1 아이디, row 1 성, row 1 이름 …). UI_SYSTEM.md 208 라인
                  label semantics 규약 준수. */}
              <table className="w-full text-small">
                <thead className="bg-elevated text-fg-secondary">
                  <tr>
                    <th scope="col" className="p-2 text-left font-normal w-8">#</th>
                    <th scope="col" className="p-2 text-left font-normal">아이디</th>
                    <th scope="col" className="p-2 text-left font-normal">성</th>
                    <th scope="col" className="p-2 text-left font-normal">이름</th>
                    <th scope="col" className="p-2 text-left font-normal">이메일 미리보기</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const preview = row.id.trim() ? `${row.id.trim().toLowerCase()}@${DOMAIN}` : "";
                    const rowNum = i + 1;
                    return (
                      <tr key={i} className="border-t border-border-subtle">
                        <td className="p-2 text-fg-muted">{rowNum}</td>
                        <td className="p-1">
                          <input
                            type="text"
                            value={row.id}
                            onChange={(e) => updateRow(i, { id: e.target.value })}
                            placeholder="hong1"
                            aria-label={`${rowNum}번째 행 아이디`}
                            data-testid={`batch-create-users-row-${i}-id`}
                            className="w-full border border-border-subtle bg-canvas px-2 py-1 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            value={row.familyName}
                            onChange={(e) => updateRow(i, { familyName: e.target.value })}
                            placeholder="홍"
                            aria-label={`${rowNum}번째 행 성`}
                            data-testid={`batch-create-users-row-${i}-family`}
                            className="w-full border border-border-subtle bg-canvas px-2 py-1 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            value={row.givenName}
                            onChange={(e) => updateRow(i, { givenName: e.target.value })}
                            placeholder="길동"
                            aria-label={`${rowNum}번째 행 이름`}
                            data-testid={`batch-create-users-row-${i}-given`}
                            className="w-full border border-border-subtle bg-canvas px-2 py-1 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
                          />
                        </td>
                        <td
                          className="p-2 font-mono text-fg-muted"
                          data-testid={`batch-create-users-row-${i}-preview`}
                        >
                          {preview}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-micro text-fg-muted">
              선택된 행 (id/성/이름 중 하나라도 입력) <strong>{filledRows.length}</strong>명 실행
              예정.
            </p>

            <DialogFooter>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                취소
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={filledRows.length === 0}
                data-testid="batch-create-users-confirm-btn"
              >
                {filledRows.length > 0 ? `${filledRows.length}명 계정 생성` : "생성"}
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === "running" && (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>전입생 일괄 생성 진행 중</DialogTitle>
              <DialogDescription>계정을 순차 생성하고 있습니다.</DialogDescription>
            </DialogHeader>
            <div className="py-8 text-center space-y-3" data-testid="batch-create-users-running">
              <div className="text-body text-fg-primary">
                진행 중: <strong className="font-mono">{progress}</strong> /{" "}
                <strong className="font-mono">{displayRows.length}</strong>
              </div>
              <div className="w-full bg-canvas h-2 border border-border-subtle">
                <div
                  className="bg-fg-primary h-full transition-all"
                  style={{
                    width: `${displayRows.length > 0 ? (progress / displayRows.length) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </>
        )}

        {phase === "done" && (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>전입생 일괄 생성 완료</DialogTitle>
              <DialogDescription>일괄 생성 작업이 완료되었습니다.</DialogDescription>
            </DialogHeader>
            <div data-testid="batch-create-users-done" className="space-y-3">
              <p className="text-body text-fg-primary">
                완료:{" "}
                <strong className="text-state-success font-mono">{successCount}</strong>명 성공
                {failCount > 0 && (
                  <>
                    {" · "}
                    <strong className="text-state-danger font-mono">{failCount}</strong>명 실패
                  </>
                )}
              </p>
              {failCount > 0 && (
                <ul
                  className="text-small text-state-danger space-y-1 max-h-40 overflow-y-auto"
                  data-testid="batch-create-users-failures"
                >
                  {results
                    .filter((r) => !r.ok)
                    .map((r) => (
                      <li key={r.primaryEmail}>
                        <span className="font-mono">{r.primaryEmail}</span>: {r.message}
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
