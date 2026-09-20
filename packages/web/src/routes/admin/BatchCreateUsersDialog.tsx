import { useState, useEffect, useMemo } from "react";
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
import { useOrgunitsCreate } from "../../api/orgunitsCreate";
import { useClassroomList } from "../../api/classroomList";
import { callClassroomTeachersAdd } from "../../api/classroomTeachersAdd";
import { callClassroomStudentsAdd } from "../../api/classroomStudentsAdd";
import { USER_FAMILY_NAME_MAX, USER_GIVEN_NAME_MAX } from "../../lib/userLimits";

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
type ClassroomRole = "teacher" | "student";

interface RowInput {
  id: string;
  familyName: string;
  givenName: string;
}

// v0.151: 각 row 의 classroom 배정 결과 (계정 생성 자체와 분리).
interface ClassroomAssignRowResult {
  courseId: string;
  courseName?: string;
  ok: boolean;
  message?: string;
}

interface RowResult {
  primaryEmail: string;
  ok: boolean;
  message?: string;
  // v0.151: 계정 생성 성공 후 시도한 classroom 배정 결과.
  classroomResults?: ClassroomAssignRowResult[];
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
  // v0.158: 첫 로그인 시 비밀번호 변경 강제 toggle. 기본 true (안전). 교사 batch 는 해제.
  const [changePasswordAtNextLogin, setChangePasswordAtNextLogin] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<RowResult[]>([]);
  // v0.132 (== v0.124 F99 대칭): confirm 시점 snapshot. 실행 중 사용자가 위 폼
  // 을 조작해도 원래 승인 대상 == 처리 대상.
  const [runRows, setRunRows] = useState<RunRowSnapshot[] | null>(null);

  const orgunitsQuery = useOrgunitsList(open);

  // v0.159: 신규 OU 인라인 생성 UI (v0.121 CreateUserDialog 대칭).
  // 기본 접힘, 「+ 새 OU 만들기」 누르면 폼 전개. 성공 시 orgUnitPath 자동 채움 + 접힘.
  const [showNewOuForm, setShowNewOuForm] = useState(false);
  const [newOuName, setNewOuName] = useState("");
  const [newOuParent, setNewOuParent] = useState("/");
  const [newOuDescription, setNewOuDescription] = useState("");
  const [newOuValidationError, setNewOuValidationError] = useState<string | null>(null);
  const [newOuSuccess, setNewOuSuccess] = useState<string | null>(null);
  const {
    mutateAsync: createOrgunit,
    isPending: isCreatingOu,
    error: newOuMutationError,
    reset: resetNewOuMutation,
  } = useOrgunitsCreate();

  // v0.151: 공통 classroom 배정 (v0.144 UX 재사용). 모든 batch row 가 동일한
  // classroom 세트에 동일 역할로 배정. CreateUserDialog 대칭이지만 폼 폭
  // 제약 (max-w-3xl · 10 rows 표) 로 별도 컬럼 대신 하단 세션 방식.
  const classroomsQuery = useClassroomList(open);
  const [classroomRole, setClassroomRole] = useState<ClassroomRole>("student");
  const [selectedClassroomIds, setSelectedClassroomIds] = useState<Set<string>>(new Set());
  const [classroomSearch, setClassroomSearch] = useState("");
  const activeClassrooms = useMemo(() => {
    const list =
      classroomsQuery.data?.courses?.filter((c) => c.courseState === "ACTIVE") ?? [];
    return [...list].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [classroomsQuery.data?.courses]);
  const filteredClassrooms = useMemo(() => {
    const q = classroomSearch.trim().toLowerCase();
    if (!q) return activeClassrooms;
    return activeClassrooms.filter((c) => {
      const name = (c.name || "").toLowerCase();
      const section = (c.section || "").toLowerCase();
      const id = (c.id || "").toLowerCase();
      return name.includes(q) || section.includes(q) || id.includes(q);
    });
  }, [activeClassrooms, classroomSearch]);
  const toggleClassroom = (id: string, checked: boolean) => {
    setSelectedClassroomIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  useEffect(() => {
    if (open) {
      setPhase("confirm");
      setRows(makeInitialRows());
      setOrgUnitPath("/");
      setInitialPassword("");
      setChangePasswordAtNextLogin(true);
      setValidationError(null);
      setProgress(0);
      setResults([]);
      setRunRows(null);
      // v0.151.
      setClassroomRole("student");
      setSelectedClassroomIds(new Set());
      setClassroomSearch("");
      // v0.159: OU inline form reset.
      setShowNewOuForm(false);
      setNewOuName("");
      setNewOuParent("/");
      setNewOuDescription("");
      setNewOuValidationError(null);
      setNewOuSuccess(null);
      resetNewOuMutation();
    }
  }, [open, resetNewOuMutation]);

  const handleOpenChange = (newOpen: boolean) => {
    // 실행 중 X · Escape · outside 로 닫히지 않게 gate.
    if (phase === "running") return;
    onOpenChange(newOpen);
  };

  // v0.159: 신규 OU 인라인 생성. v0.121 CreateUserDialog 대칭 (동일 검증 규칙).
  const handleCreateOrgunit = async () => {
    setNewOuValidationError(null);
    setNewOuSuccess(null);
    resetNewOuMutation();

    const name = newOuName.trim();
    const parent = newOuParent.trim();
    if (!name) return setNewOuValidationError("OU 이름을 입력해주세요.");
    if (name.length > 100) return setNewOuValidationError("OU 이름은 100자 이하여야 합니다.");
    if (name.includes("/") || name.includes("\\"))
      return setNewOuValidationError("OU 이름에 슬래시(/, \\)를 사용할 수 없습니다.");
    if (!parent || !parent.startsWith("/"))
      return setNewOuValidationError("부모 경로는 「/」 로 시작해야 합니다.");

    try {
      const res = await createOrgunit({
        name,
        parentOrgUnitPath: parent,
        description: newOuDescription.trim() || undefined,
      });
      setOrgUnitPath(res.orgUnitPath);
      setNewOuSuccess(`OU 「${res.orgUnitPath}」 를 생성했습니다.`);
      setNewOuName("");
      setNewOuDescription("");
      setShowNewOuForm(false);
    } catch {
      // 렌더에서 newOuMutationError 로 표시.
    }
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
      // v0.178: Google Directory User familyName/givenName 각 60자 상한.
      if (r.familyName.length > USER_FAMILY_NAME_MAX)
        return setValidationError(
          `「${r.id}」 의 성은 최대 ${USER_FAMILY_NAME_MAX}자까지 입력 가능합니다 (현재 ${r.familyName.length}자).`,
        );
      if (r.givenName.length > USER_GIVEN_NAME_MAX)
        return setValidationError(
          `「${r.id}」 의 이름은 최대 ${USER_GIVEN_NAME_MAX}자까지 입력 가능합니다 (현재 ${r.givenName.length}자).`,
        );
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

    // v0.151: 배정 snapshot = confirm 시점의 selectedClassroomIds + role.
    // 사용자가 실행 중 폼을 조작해도 원본 승인 대상 유지 (v0.132 F99 대칭).
    const classroomSnapshot: Array<{ id: string; name?: string }> = activeClassrooms
      .filter((c) => selectedClassroomIds.has(c.id))
      .map((c) => ({ id: c.id, name: c.name }));
    const classroomRoleSnapshot: ClassroomRole = classroomRole;
    const classroomAddCall =
      classroomRoleSnapshot === "teacher"
        ? callClassroomTeachersAdd
        : callClassroomStudentsAdd;

    for (let i = 0; i < snapshot.length; i++) {
      const row = snapshot[i];
      try {
        await callUsersCreate({
          primaryEmail: row.primaryEmail,
          givenName: row.givenName,
          familyName: row.familyName,
          password: passwordForRun,
          orgUnitPath: orgu,
          changePasswordAtNextLogin,
        });
        // 계정 생성 성공 → classroom 배정 (있으면).
        const classroomResults: ClassroomAssignRowResult[] = [];
        for (const c of classroomSnapshot) {
          try {
            await classroomAddCall({ courseId: c.id, userId: row.primaryEmail });
            classroomResults.push({ courseId: c.id, courseName: c.name, ok: true });
          } catch (ce) {
            classroomResults.push({
              courseId: c.id,
              courseName: c.name,
              ok: false,
              message: (ce as Error).message,
            });
          }
        }
        localResults.push({
          primaryEmail: row.primaryEmail,
          ok: true,
          classroomResults: classroomResults.length > 0 ? classroomResults : undefined,
        });
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
    if (classroomSnapshot.length > 0) {
      queryClient.invalidateQueries({ queryKey: ["classroom"] });
    }
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
                <p className="mt-1 text-micro text-fg-muted">
                  기존 조직 단위에서 선택하거나 아래에서 새 OU 를 만들 수 있습니다.
                </p>

                {/* v0.159: 신규 OU 인라인 생성 (v0.121 CreateUserDialog 대칭). */}
                {newOuSuccess && !showNewOuForm && (
                  <p
                    className="mt-2 text-small text-state-success"
                    data-testid="batch-create-users-new-ou-success"
                  >
                    {newOuSuccess}
                  </p>
                )}

                {!showNewOuForm ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewOuForm(true);
                      setNewOuValidationError(null);
                      setNewOuSuccess(null);
                      resetNewOuMutation();
                      setNewOuParent(orgUnitPath.trim() || "/");
                    }}
                    data-testid="batch-create-users-new-ou-toggle"
                    className="mt-2 text-small text-fg-primary underline underline-offset-2"
                  >
                    + 새 OU 만들기
                  </button>
                ) : (
                  <div
                    className="mt-2 space-y-2 border border-border-subtle p-3 bg-elevated"
                    data-testid="batch-create-users-new-ou-form"
                  >
                    <p className="text-small text-fg-primary font-medium">새 OU 만들기</p>
                    <div>
                      <label
                        htmlFor="batch-create-users-new-ou-name"
                        className="text-small text-fg-secondary mb-1 block"
                      >
                        이름 *
                      </label>
                      <input
                        id="batch-create-users-new-ou-name"
                        type="text"
                        value={newOuName}
                        onChange={(e) => setNewOuName(e.target.value)}
                        placeholder="예: 3학년"
                        disabled={isCreatingOu}
                        data-testid="batch-create-users-new-ou-name"
                        className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="batch-create-users-new-ou-parent"
                        className="text-small text-fg-secondary mb-1 block"
                      >
                        부모 경로 *
                      </label>
                      <input
                        id="batch-create-users-new-ou-parent"
                        type="text"
                        value={newOuParent}
                        onChange={(e) => setNewOuParent(e.target.value)}
                        placeholder="/학생"
                        list="batch-create-users-orgunits-list"
                        disabled={isCreatingOu}
                        data-testid="batch-create-users-new-ou-parent"
                        className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                      <p className="mt-1 text-micro text-fg-muted">
                        최상위는 「/」 하나만 입력. 기존 OU 목록에서 선택 가능.
                      </p>
                    </div>
                    <div>
                      <label
                        htmlFor="batch-create-users-new-ou-description"
                        className="text-small text-fg-secondary mb-1 block"
                      >
                        설명 (선택)
                      </label>
                      <input
                        id="batch-create-users-new-ou-description"
                        type="text"
                        value={newOuDescription}
                        onChange={(e) => setNewOuDescription(e.target.value)}
                        placeholder="예: 3학년 학생 소속 OU"
                        disabled={isCreatingOu}
                        data-testid="batch-create-users-new-ou-description"
                        className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    </div>
                    {(newOuValidationError || newOuMutationError) && (
                      <p
                        className="text-small text-state-danger"
                        data-testid="batch-create-users-new-ou-error"
                      >
                        {newOuValidationError ??
                          (newOuMutationError!.message.includes("already-exists") ||
                          newOuMutationError!.message.includes("orgunit_already_exists")
                            ? "이미 존재하는 OU 입니다."
                            : newOuMutationError!.message.includes("permission-denied")
                              ? "OU 생성 권한이 없거나 스코프가 부족합니다."
                              : `OU 생성 실패: ${newOuMutationError!.message}`)}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="default"
                        onClick={handleCreateOrgunit}
                        disabled={isCreatingOu}
                        data-testid="batch-create-users-new-ou-submit"
                      >
                        {isCreatingOu ? "OU 생성 중..." : "OU 만들기"}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setShowNewOuForm(false);
                          setNewOuValidationError(null);
                          resetNewOuMutation();
                        }}
                        disabled={isCreatingOu}
                        data-testid="batch-create-users-new-ou-cancel"
                      >
                        취소
                      </Button>
                    </div>
                  </div>
                )}
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
                  placeholder="8자 이상"
                  data-testid="batch-create-users-password-input"
                  className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
                />
                {/* v0.158: 첫 로그인 시 비밀번호 변경 강제 toggle (모두 공통). */}
                <label className="flex items-center gap-2 mt-2 text-small text-fg-primary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={changePasswordAtNextLogin}
                    onChange={(e) => setChangePasswordAtNextLogin(e.target.checked)}
                    data-testid="batch-create-users-change-pw-toggle"
                  />
                  첫 로그인 시 비밀번호 변경 강제 (모두 공통)
                </label>
              </div>
            </div>

            {/* v0.151: 공통 클래스룸 자동 배정 (선택). 모든 batch row 가 같은
                클래스룸에 같은 역할로 배정. v0.144 CreateUserDialog UX 대칭
                (검색 · 이름순 정렬 · 선택 유지). */}
            <div
              className="space-y-2 border border-border-subtle p-3 bg-elevated"
              data-testid="batch-create-users-classroom-section"
            >
              <p className="text-small text-fg-primary font-medium">
                클래스룸 자동 배정 (모두 공통, 선택)
              </p>
              <p className="text-small text-fg-secondary">
                계정 생성 후 선택한 클래스룸에 지정 역할로 각 계정을 자동 배정합니다.
              </p>
              <div
                className="flex items-center gap-4"
                role="group"
                aria-label="클래스룸 배정 역할"
              >
                <label className="flex items-center gap-2 text-small text-fg-primary cursor-pointer">
                  <input
                    type="radio"
                    name="batch-classroom-role"
                    value="student"
                    checked={classroomRole === "student"}
                    onChange={() => setClassroomRole("student")}
                    data-testid="batch-create-users-classroom-role-student"
                  />
                  학생
                </label>
                <label className="flex items-center gap-2 text-small text-fg-primary cursor-pointer">
                  <input
                    type="radio"
                    name="batch-classroom-role"
                    value="teacher"
                    checked={classroomRole === "teacher"}
                    onChange={() => setClassroomRole("teacher")}
                    data-testid="batch-create-users-classroom-role-teacher"
                  />
                  교사
                </label>
              </div>
              {classroomsQuery.isLoading && (
                <p
                  className="text-small text-fg-muted"
                  data-testid="batch-create-users-classrooms-loading"
                >
                  클래스룸 목록 불러오는 중...
                </p>
              )}
              {classroomsQuery.isError && (
                <p
                  className="text-small text-state-danger"
                  data-testid="batch-create-users-classrooms-error"
                >
                  클래스룸 목록 로드 실패:{" "}
                  {classroomsQuery.error?.message || "알 수 없는 오류"}
                </p>
              )}
              {!classroomsQuery.isLoading &&
                !classroomsQuery.isError &&
                activeClassrooms.length === 0 && (
                  <p
                    className="text-small text-fg-muted"
                    data-testid="batch-create-users-classrooms-empty"
                  >
                    ACTIVE 상태의 클래스룸이 없습니다.
                  </p>
                )}
              {activeClassrooms.length > 0 && (
                <>
                  <div>
                    <label
                      htmlFor="batch-create-users-classroom-search"
                      className="sr-only"
                    >
                      클래스룸 검색
                    </label>
                    <input
                      id="batch-create-users-classroom-search"
                      type="text"
                      value={classroomSearch}
                      onChange={(e) => setClassroomSearch(e.target.value)}
                      placeholder={`클래스룸 검색 (총 ${activeClassrooms.length}개)`}
                      data-testid="batch-create-users-classroom-search"
                      className="w-full border border-border-subtle bg-canvas px-3 py-2 text-small text-fg-primary placeholder:text-fg-muted focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
                    />
                  </div>
                  {filteredClassrooms.length === 0 ? (
                    <p
                      className="text-small text-fg-muted py-2"
                      data-testid="batch-create-users-classrooms-search-empty"
                    >
                      검색 결과가 없습니다.
                    </p>
                  ) : (
                    <div
                      className="max-h-40 overflow-y-auto border border-border-subtle bg-canvas p-2 space-y-1"
                      data-testid="batch-create-users-classrooms-list"
                    >
                      {filteredClassrooms.map((c) => (
                        <label
                          key={c.id}
                          className="flex items-center gap-2 text-small text-fg-primary cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedClassroomIds.has(c.id)}
                            onChange={(e) => toggleClassroom(c.id, e.target.checked)}
                            data-testid={`batch-create-users-classroom-cb-${c.id}`}
                          />
                          <span>{c.name || c.id}</span>
                          {c.section && (
                            <span className="text-fg-muted text-micro">({c.section})</span>
                          )}
                        </label>
                      ))}
                    </div>
                  )}
                </>
              )}
              {selectedClassroomIds.size > 0 && (
                <p
                  className="text-small text-fg-secondary"
                  data-testid="batch-create-users-classrooms-selected"
                >
                  선택됨: {selectedClassroomIds.size}개 · 각 계정마다 자동 배정 (총{" "}
                  {selectedClassroomIds.size * filledRows.length} 배정 호출).
                  {classroomSearch.trim().length > 0 &&
                    ` · 검색 결과 ${filteredClassrooms.length}/${activeClassrooms.length}`}
                </p>
              )}
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
                    // v0.178: 각 이름 필드 60자 상한 초과 시 input 을 red border.
                    const familyTooLong = row.familyName.trim().length > USER_FAMILY_NAME_MAX;
                    const givenTooLong = row.givenName.trim().length > USER_GIVEN_NAME_MAX;
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
                            aria-invalid={familyTooLong || undefined}
                            data-testid={`batch-create-users-row-${i}-family`}
                            className={`w-full border ${
                              familyTooLong ? 'border-state-danger' : 'border-border-subtle'
                            } bg-canvas px-2 py-1 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong`}
                          />
                          {familyTooLong && (
                            <p
                              className="mt-1 text-micro text-state-danger"
                              data-testid={`batch-create-users-row-${i}-family-warn`}
                            >
                              최대 {USER_FAMILY_NAME_MAX}자 초과 (현재 {row.familyName.trim().length}자)
                            </p>
                          )}
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            value={row.givenName}
                            onChange={(e) => updateRow(i, { givenName: e.target.value })}
                            placeholder="길동"
                            aria-label={`${rowNum}번째 행 이름`}
                            aria-invalid={givenTooLong || undefined}
                            data-testid={`batch-create-users-row-${i}-given`}
                            className={`w-full border ${
                              givenTooLong ? 'border-state-danger' : 'border-border-subtle'
                            } bg-canvas px-2 py-1 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong`}
                          />
                          {givenTooLong && (
                            <p
                              className="mt-1 text-micro text-state-danger"
                              data-testid={`batch-create-users-row-${i}-given-warn`}
                            >
                              최대 {USER_GIVEN_NAME_MAX}자 초과 (현재 {row.givenName.trim().length}자)
                            </p>
                          )}
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
            {(() => {
              // v0.178: 이름 상한 초과 row 카운트 요약.
              const overlyLongCount = rows.filter(
                (r) =>
                  r.familyName.trim().length > USER_FAMILY_NAME_MAX ||
                  r.givenName.trim().length > USER_GIVEN_NAME_MAX,
              ).length;
              if (overlyLongCount === 0) return null;
              return (
                <p
                  className="text-micro text-state-danger"
                  data-testid="batch-create-users-name-limit-summary"
                >
                  이름 상한 초과 <strong>{overlyLongCount}</strong>개 행 — 실행 전 60자 이내로 수정하세요.
                </p>
              );
            })()}

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
              {/* v0.151: 계정 성공 · classroom 배정 일부 실패한 경우 별도 표시. */}
              {(() => {
                const partialFails = results
                  .filter((r) => r.ok && r.classroomResults?.some((c) => !c.ok))
                  .flatMap((r) =>
                    (r.classroomResults ?? [])
                      .filter((c) => !c.ok)
                      .map((c) => ({ email: r.primaryEmail, ...c })),
                  );
                if (partialFails.length === 0) return null;
                return (
                  <div
                    className="border border-state-warning p-3 text-small text-fg-primary space-y-1"
                    data-testid="batch-create-users-classroom-failures"
                  >
                    <p>
                      계정은 생성됐으나 일부 클래스룸 배정이 실패했습니다 (
                      <strong className="font-mono">{partialFails.length}</strong>건). 필요 시
                      각 클래스룸 상세 페이지에서 직접 추가하세요.
                    </p>
                    <ul className="pl-4 list-disc space-y-1 max-h-40 overflow-y-auto">
                      {partialFails.map((f, i) => (
                        <li key={`${f.email}::${f.courseId}::${i}`} className="text-state-danger">
                          <span className="font-mono">{f.email}</span> →{" "}
                          <span className="font-mono">{f.courseName || f.courseId}</span>:{" "}
                          {f.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })()}
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
