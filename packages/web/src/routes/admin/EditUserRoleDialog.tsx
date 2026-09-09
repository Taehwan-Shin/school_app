import { useState, useEffect, type FormEvent } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { useUsersUpdateRole } from '../../api/usersUpdateRole';
import { useUserRole } from '../../api/usersGetRole';
import type { Role } from '@school-app/shared';

export interface EditUserRoleTarget {
  email: string;
}

export interface EditUserRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: EditUserRoleTarget | null;
}

const ROLE_OPTIONS: { value: Role; label: string; description: string }[] = [
  { value: 'super_admin', label: 'super_admin', description: '전권 · 감사 로그 · 역할 관리 포함' },
  { value: 'admin', label: 'admin', description: '사용자·그룹·챗·클래스룸 관리 · 감사·역할관리 제외' },
  { value: 'teacher', label: 'teacher', description: 'Classroom 코스만 조회·생성·보관' },
];

export function EditUserRoleDialog({ open, onOpenChange, user }: EditUserRoleDialogProps) {
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const { mutateAsync, isPending, error, reset } = useUsersUpdateRole();
  const {
    data: roleData,
    isLoading: isRoleLoading,
    isError: isRoleError,
    error: roleError,
  } = useUserRole(user?.email ?? null, open);
  const currentRole: Role | null = roleData?.role ?? null;

  useEffect(() => {
    if (user) {
      setSelectedRole(null);
      setValidationError(null);
      reset();
    }
  }, [user, reset]);

  const handleClose = (next: boolean) => {
    if (!next) {
      setValidationError(null);
      reset();
    }
    onOpenChange(next);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    if (!user) return;

    if (selectedRole === null) {
      setValidationError('새 역할을 선택해주세요.');
      return;
    }

    if (currentRole === selectedRole) {
      setValidationError('현재와 동일한 역할입니다.');
      return;
    }

    // 현재 role 이 로드 안 됐거나 오류인 상태에서는 확인 문구를 요구 (F17/F20 실수 강등 방어 — fail-closed).
    if (isRoleLoading) {
      setValidationError('현재 역할을 확인하는 중입니다. 잠시 기다려주세요.');
      return;
    }
    if (isRoleError) {
      setValidationError('현재 역할 조회에 실패했습니다. 대화상자를 닫고 다시 시도해주세요.');
      return;
    }

    try {
      await mutateAsync({ primaryEmail: user.email, role: selectedRole });
      handleClose(false);
    } catch {
      // Error surface is via `error` state; keep dialog open.
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent data-testid="edit-user-role-dialog" className="max-w-md">
        <DialogHeader>
          <DialogTitle>역할 변경</DialogTitle>
          <DialogDescription>
            {user ? (
              <>
                <span className="font-mono">{user.email}</span> 의 역할을 변경합니다. 대상 사용자는
                로그아웃·재로그인 후 새 역할이 반영됩니다.
              </>
            ) : (
              '역할을 변경할 사용자를 선택해주세요.'
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="text-small text-fg-secondary mb-2" data-testid="edit-user-role-current">
              현재 역할:{' '}
              {isRoleLoading ? (
                <span className="text-fg-muted">불러오는 중...</span>
              ) : isRoleError ? (
                <span className="text-state-danger">
                  확인 실패: {roleError?.message || '알 수 없음'}
                </span>
              ) : (
                <span className="font-mono text-fg-primary">
                  {currentRole ?? '(할당되지 않음)'}
                </span>
              )}
            </div>
            <div className="space-y-2" role="radiogroup" data-testid="edit-user-role-options">
              {ROLE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-start gap-3 p-3 border border-border-subtle cursor-pointer hover:bg-canvas-subtle"
                >
                  <input
                    type="radio"
                    name="role"
                    value={opt.value}
                    checked={selectedRole === opt.value}
                    onChange={() => setSelectedRole(opt.value)}
                    data-testid={`edit-user-role-radio-${opt.value}`}
                    className="mt-1 accent-fg-primary cursor-pointer"
                  />
                  <div>
                    <div className="font-mono text-body text-fg-primary">
                      {opt.label}
                      {currentRole === opt.value && (
                        <span className="ml-2 text-xs text-fg-secondary">(현재)</span>
                      )}
                    </div>
                    <div className="text-xs text-fg-secondary">{opt.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {validationError && (
            <div
              className="border border-state-warning p-2 text-small text-state-warning"
              data-testid="edit-user-role-validation-error"
            >
              {validationError}
            </div>
          )}

          {error && (
            <div
              className="border border-state-danger p-2 text-small text-state-danger"
              data-testid="edit-user-role-error"
            >
              변경 실패: {error.message}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleClose(false)}
              disabled={isPending}
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={
                !user ||
                isPending ||
                isRoleLoading ||
                isRoleError ||
                selectedRole === null ||
                selectedRole === currentRole
              }
              data-testid="edit-user-role-submit"
            >
              {isPending ? '변경 중...' : '역할 변경'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
