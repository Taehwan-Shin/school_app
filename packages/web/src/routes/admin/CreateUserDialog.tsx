import { useEffect, useState, type FormEvent } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { useCreateUser } from '../../api/usersCreate';
import { useOrgunitsList } from '../../api/orgunitsList';
import { useClassroomList } from '../../api/classroomList';
import { callClassroomTeachersAdd } from '../../api/classroomTeachersAdd';
import { callClassroomStudentsAdd } from '../../api/classroomStudentsAdd';

export interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ClassroomRole = 'teacher' | 'student';

interface ClassroomAssignResult {
  courseId: string;
  courseName?: string;
  ok: boolean;
  message?: string;
}

// v0.119: 계정 생성 시 (1) 기존 OU 를 드롭다운으로 선택 + 직접 입력 (HTML5
// datalist 로 native combobox) (2) 기존 클래스룸을 체크박스로 골라 role 별
// (teacher/student) 로 자동 배정. 클래스룸 배정 부분 실패는 계정 생성 자체는
// 성공한 상태에서 alert 로 남기고 dialog 는 닫지 않음.
export function CreateUserDialog({ open, onOpenChange }: CreateUserDialogProps) {
  const [primaryEmail, setPrimaryEmail] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [givenName, setGivenName] = useState('');
  const [password, setPassword] = useState('');
  const [orgUnitPath, setOrgUnitPath] = useState('/');
  const [classroomRole, setClassroomRole] = useState<ClassroomRole>('student');
  const [selectedClassroomIds, setSelectedClassroomIds] = useState<Set<string>>(new Set());
  const [validationError, setValidationError] = useState<string | null>(null);
  const [assignResults, setAssignResults] = useState<ClassroomAssignResult[] | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);

  const { mutateAsync: createUser, isPending: isCreating, error: mutationError } = useCreateUser();
  const orgunitsQuery = useOrgunitsList(open);
  // v0.119b F94: dialog 닫힌 상태에서는 classroom API/감사 호출 안 나게 `open` gate.
  // AccountsTable 은 CreateUserDialog 를 항상 mount 하므로 훅 자체가 실행되지 않게
  // enabled=open 으로 gate.
  const classroomsQuery = useClassroomList(open);

  const activeClassrooms =
    classroomsQuery.data?.courses?.filter((c) => c.courseState === 'ACTIVE') ?? [];

  const resetForm = () => {
    setPrimaryEmail('');
    setFamilyName('');
    setGivenName('');
    setPassword('');
    setOrgUnitPath('/');
    setClassroomRole('student');
    setSelectedClassroomIds(new Set());
    setValidationError(null);
    setAssignResults(null);
    setIsAssigning(false);
  };

  useEffect(() => {
    if (open) {
      // 여는 순간마다 이전 결과 초기화.
      setValidationError(null);
      setAssignResults(null);
    }
  }, [open]);

  const handleClose = (newOpen: boolean) => {
    // v0.119c F95: 계정 생성/배정 중에는 X · Escape · outside click 로 닫히지
    // 않도록 차단. mutation 은 비동기라 dialog 가 unmount 돼도 계속 실행됨 →
    // 사용자는 결과를 못 보고 재열면 중복 작업 위험.
    if (!newOpen && isCreating) return;
    if (!newOpen && isAssigning) return;
    if (!newOpen) resetForm();
    onOpenChange(newOpen);
  };

  const toggleClassroom = (id: string, checked: boolean) => {
    setSelectedClassroomIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const isBusy = isCreating || isAssigning;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setAssignResults(null);

    const trimmedEmail = primaryEmail.trim();
    if (!trimmedEmail) return setValidationError('이메일을 입력해주세요.');
    if (!trimmedEmail.endsWith('@cam.hs.kr'))
      return setValidationError('이메일은 @cam.hs.kr 도메인이어야 합니다.');
    if (!familyName.trim()) return setValidationError('성을 입력해주세요.');
    if (!givenName.trim()) return setValidationError('이름을 입력해주세요.');
    if (!password || password.length < 8)
      return setValidationError('비밀번호는 최소 8자 이상이어야 합니다.');

    // v0.119b F92: submit 시점의 role/classrooms/course-name 을 snapshot 으로
    // 고정. 실행 중 사용자가 값을 바꿔도 원래 선택한 대로 배정. busy 중에는
    // 아래 render 에서 input/radio/checkbox 도 disabled 처리.
    const roleSnapshot: ClassroomRole = classroomRole;
    const classroomSnapshot: Array<{ id: string; name?: string }> = Array.from(
      selectedClassroomIds,
    ).map((id) => {
      const course = activeClassrooms.find((c) => c.id === id);
      return { id, name: course?.name };
    });

    try {
      await createUser({
        primaryEmail: trimmedEmail,
        familyName: familyName.trim(),
        givenName: givenName.trim(),
        password,
        orgUnitPath: orgUnitPath.trim() || '/',
        changePasswordAtNextLogin: true,
      });
    } catch {
      // Mutation error rendered below; do NOT proceed to classroom assign.
      return;
    }

    // v0.119b F93: 계정 생성 성공. 초기 비밀번호는 메모리에서 즉시 제거.
    // dialog 가 assign-results 배너로 유지될 경우에도 password state 는 안 남음.
    setPassword('');

    // 계정 생성 성공. 이제 snapshot 기준으로 순차 add.
    if (classroomSnapshot.length === 0) {
      handleClose(false);
      return;
    }

    setIsAssigning(true);
    const results: ClassroomAssignResult[] = [];
    const addFn =
      roleSnapshot === 'teacher' ? callClassroomTeachersAdd : callClassroomStudentsAdd;
    for (const { id: courseId, name } of classroomSnapshot) {
      try {
        await addFn({ courseId, userId: trimmedEmail });
        results.push({ courseId, courseName: name, ok: true });
      } catch (err) {
        results.push({
          courseId,
          courseName: name,
          ok: false,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
    setIsAssigning(false);
    const anyFail = results.some((r) => !r.ok);
    if (anyFail) {
      // 계정 자체는 이미 생성됐고 일부 클래스룸만 실패. dialog 를 열어두고
      // 사용자가 결과를 확인 후 닫도록.
      setAssignResults(results);
    } else {
      handleClose(false);
    }
  };

  const errorMessage =
    validationError ||
    (mutationError
      ? mutationError.message.includes('permission-denied')
        ? '계정 생성 권한이 없거나 스코프가 부족합니다.'
        : mutationError.message.includes('invalid_email_domain')
          ? '허용되지 않는 이메일 도메인입니다.'
          : `계정 생성 실패: ${mutationError.message}`
      : null);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle>Google Workspace 계정 추가</DialogTitle>
            <DialogDescription>
              새 사용자의 기본 정보를 입력하여 Google Workspace 계정을 생성합니다. 아래에서
              기존 클래스룸을 선택하면 계정 생성 후 자동으로 배정합니다.
            </DialogDescription>
          </DialogHeader>

          {errorMessage && (
            <div
              className="border border-state-danger p-3 text-small text-state-danger"
              data-testid="create-user-error"
            >
              {errorMessage}
            </div>
          )}

          {assignResults && (
            <div
              className="border border-state-warning p-3 text-small text-fg-primary space-y-1"
              data-testid="create-user-assign-results"
            >
              <p>
                계정은 생성됐으나 일부 클래스룸 배정이 실패했습니다. 필요 시 클래스룸 상세
                페이지에서 직접 추가해 주세요.
              </p>
              <ul className="pl-4 list-disc space-y-1">
                {assignResults.map((r) => (
                  <li key={r.courseId} className={r.ok ? 'text-state-success' : 'text-state-danger'}>
                    <span className="font-mono">{r.courseName || r.courseId}</span>:{' '}
                    {r.ok ? '성공' : `실패 — ${r.message}`}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="primaryEmail" className="text-small text-fg-secondary mb-1 block">
                이메일 *
              </label>
              <input
                id="primaryEmail"
                type="email"
                required
                value={primaryEmail}
                onChange={(e) => setPrimaryEmail(e.target.value)}
                placeholder="user@cam.hs.kr"
                disabled={isBusy}
                className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label htmlFor="familyName" className="text-small text-fg-secondary mb-1 block">
                성 *
              </label>
              <input
                id="familyName"
                type="text"
                required
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                placeholder="홍"
                disabled={isBusy}
                className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label htmlFor="givenName" className="text-small text-fg-secondary mb-1 block">
                이름 *
              </label>
              <input
                id="givenName"
                type="text"
                required
                value={givenName}
                onChange={(e) => setGivenName(e.target.value)}
                placeholder="길동"
                disabled={isBusy}
                className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label htmlFor="password" className="text-small text-fg-secondary mb-1 block">
                비밀번호 *
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8자 이상"
                disabled={isBusy}
                className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            {/* v0.119 / v0.119b F91: OU combobox — datalist 기반. 기존 OU 를
                dropdown 으로 선택. 직접 입력은 「이미 존재하는 OU 경로」를 대상
                으로 하며 (자동완성 없이 정확히 타이핑), 신규 OU 생성은 이 슬라이스
                범위 외 (Directory API `orgunits.insert` 별도 필요). 존재하지
                않는 경로를 주면 Google API 가 users.insert 를 400 으로 거절. */}
            <div>
              <label htmlFor="orgUnitPath" className="text-small text-fg-secondary mb-1 block">
                조직 단위
                {orgunitsQuery.isLoading && (
                  <span className="text-fg-muted ml-2">불러오는 중...</span>
                )}
                {orgunitsQuery.isError && (
                  <span
                    className="text-state-danger ml-2"
                    data-testid="create-user-orgunits-error"
                  >
                    OU 목록 로드 실패
                  </span>
                )}
              </label>
              <input
                id="orgUnitPath"
                type="text"
                value={orgUnitPath}
                onChange={(e) => setOrgUnitPath(e.target.value)}
                placeholder="/학생/1학년 (기존 OU 목록에서 선택)"
                list="create-user-orgunits-list"
                data-testid="create-user-orgunit-input"
                disabled={isBusy}
                className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong disabled:opacity-60 disabled:cursor-not-allowed"
              />
              <p className="mt-1 text-micro text-fg-muted">
                기존에 있는 조직 단위 경로만 사용할 수 있습니다. 새 OU 는 Google
                Workspace 관리 콘솔에서 먼저 만든 뒤 여기서 선택하세요.
              </p>
              <datalist id="create-user-orgunits-list" data-testid="create-user-orgunits-datalist">
                {(orgunitsQuery.data?.orgUnits ?? []).map((ou) => (
                  <option key={ou.orgUnitPath} value={ou.orgUnitPath}>
                    {ou.name ? `${ou.orgUnitPath} — ${ou.name}` : ou.orgUnitPath}
                  </option>
                ))}
              </datalist>
            </div>

            {/* v0.119: 클래스룸 자동 배정. */}
            <div className="space-y-2 border border-border-subtle p-3 bg-elevated">
              <p className="text-small text-fg-primary font-medium">
                클래스룸 자동 배정 (선택)
              </p>
              <p className="text-small text-fg-secondary">
                계정 생성 후 아래에서 체크한 클래스룸에 지정한 역할로 자동 추가합니다.
              </p>

              <div
                className="flex items-center gap-4"
                role="group"
                aria-label="클래스룸 배정 역할"
              >
                <label className="flex items-center gap-2 text-small text-fg-primary cursor-pointer">
                  <input
                    type="radio"
                    name="classroom-role"
                    value="student"
                    checked={classroomRole === 'student'}
                    onChange={() => setClassroomRole('student')}
                    disabled={isBusy}
                    data-testid="create-user-classroom-role-student"
                  />
                  학생
                </label>
                <label className="flex items-center gap-2 text-small text-fg-primary cursor-pointer">
                  <input
                    type="radio"
                    name="classroom-role"
                    value="teacher"
                    checked={classroomRole === 'teacher'}
                    onChange={() => setClassroomRole('teacher')}
                    disabled={isBusy}
                    data-testid="create-user-classroom-role-teacher"
                  />
                  교사
                </label>
              </div>

              {classroomsQuery.isLoading && (
                <p className="text-small text-fg-muted" data-testid="create-user-classrooms-loading">
                  클래스룸 목록 불러오는 중...
                </p>
              )}
              {classroomsQuery.isError && (
                <p
                  className="text-small text-state-danger"
                  data-testid="create-user-classrooms-error"
                >
                  클래스룸 목록 로드 실패: {classroomsQuery.error?.message || '알 수 없는 오류'}
                </p>
              )}
              {!classroomsQuery.isLoading && !classroomsQuery.isError && activeClassrooms.length === 0 && (
                <p
                  className="text-small text-fg-muted"
                  data-testid="create-user-classrooms-empty"
                >
                  ACTIVE 상태의 클래스룸이 없습니다.
                </p>
              )}
              {activeClassrooms.length > 0 && (
                <div
                  className="max-h-40 overflow-y-auto border border-border-subtle bg-canvas p-2 space-y-1"
                  data-testid="create-user-classrooms-list"
                >
                  {activeClassrooms.map((c) => (
                    <label
                      key={c.id}
                      className="flex items-center gap-2 text-small text-fg-primary cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedClassroomIds.has(c.id)}
                        onChange={(e) => toggleClassroom(c.id, e.target.checked)}
                        disabled={isBusy}
                        data-testid={`create-user-classroom-cb-${c.id}`}
                      />
                      <span>{c.name || c.id}</span>
                      {c.section && (
                        <span className="text-fg-muted text-micro">({c.section})</span>
                      )}
                    </label>
                  ))}
                </div>
              )}
              {selectedClassroomIds.size > 0 && (
                <p
                  className="text-small text-fg-secondary"
                  data-testid="create-user-classrooms-selected"
                >
                  선택됨: {selectedClassroomIds.size}개
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleClose(false)}
              disabled={isBusy}
            >
              {assignResults ? '닫기' : '취소'}
            </Button>
            {!assignResults && (
              <Button
                type="submit"
                variant="default"
                disabled={isBusy}
                data-testid="create-user-submit"
              >
                {isCreating
                  ? '생성 중...'
                  : isAssigning
                    ? `클래스룸 배정 중... (${selectedClassroomIds.size}개)`
                    : selectedClassroomIds.size > 0
                      ? `계정 생성 + ${selectedClassroomIds.size}개 배정`
                      : '저장'}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
