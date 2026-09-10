import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { callUsersResetPassword } from '../../api/usersResetPassword';

export interface BulkResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emails: string[];
  onDone?: () => void;
}

type Phase = 'confirm' | 'running' | 'done';

// v0.113: 원본 「비밀번호 일괄 변경」 (Apps Script updateUserPasswords) 포팅.
// 선택된 계정에 공통 비밀번호 하나를 순차 적용. changePasswordAtNextLogin=true (기본) 로
// 사용자가 첫 로그인 시 강제 변경. 개별 usersResetPassword callable 을 for-loop 호출 —
// 서버는 이미 audit log (users.reset_password) 를 남김.
export function BulkResetPasswordDialog({
  open,
  onOpenChange,
  emails,
  onDone,
}: BulkResetPasswordDialogProps) {
  const [phase, setPhase] = useState<Phase>('confirm');
  const [progress, setProgress] = useState(0);
  const [failures, setFailures] = useState<{ email: string; message: string }[]>([]);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changePasswordAtNextLogin, setChangePasswordAtNextLogin] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPhase('confirm');
      setProgress(0);
      setFailures([]);
      setNewPassword('');
      setConfirmPassword('');
      setChangePasswordAtNextLogin(true);
      setValidationError(null);
    }
  }, [open]);

  // v0.113b F65: 평문 비밀번호가 dialog state 에 잔존하지 않도록 close 시 즉시 clear.
  const clearSensitiveState = () => {
    setNewPassword('');
    setConfirmPassword('');
    setValidationError(null);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (phase === 'running') return;
    if (!newOpen) {
      clearSensitiveState();
      if (phase === 'done') {
        onDone?.();
      }
    }
    onOpenChange(newOpen);
  };

  const validate = (): string | null => {
    if (newPassword.length < 8) return '비밀번호는 최소 8자 이상.';
    if (newPassword !== confirmPassword) return '비밀번호가 일치하지 않음.';
    return null;
  };

  const handleConfirm = async () => {
    const err = validate();
    if (err) {
      setValidationError(err);
      return;
    }
    setValidationError(null);
    // v0.113b F65: 실행용 평문 비밀번호를 local 변수로 고정 후 state 는 즉시 clear.
    // done phase 에 도달했을 때 이미 state 는 비어있게 해서 dialog 가 열린 채로 남아도
    // 평문이 메모리 (React state) 에 남지 않게. changePasswordAtNextLogin 도 로컬로.
    const passwordForRun = newPassword;
    const forceChangeForRun = changePasswordAtNextLogin;
    clearSensitiveState();
    setPhase('running');
    const localFailures: { email: string; message: string }[] = [];
    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      try {
        await callUsersResetPassword({
          primaryEmail: email,
          newPassword: passwordForRun,
          changePasswordAtNextLogin: forceChangeForRun,
        });
      } catch (e) {
        localFailures.push({ email, message: (e as Error).message });
      }
      setProgress(i + 1);
    }
    setFailures(localFailures);
    setPhase('done');
    // users list 무효화 불필요 (필드 무변화).
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={phase === 'running' ? '[&>button]:hidden' : undefined}>
        {phase === 'confirm' && (
          <>
            <DialogHeader>
              <DialogTitle>비밀번호 일괄 변경</DialogTitle>
              <DialogDescription>
                선택한 {emails.length}명 계정에 같은 비밀번호를 설정합니다. 다음 로그인 시
                변경 강제 옵션은 기본 활성.
              </DialogDescription>
            </DialogHeader>
            <ul className="text-small text-fg-secondary max-h-40 overflow-y-auto space-y-1">
              {emails.slice(0, 5).map((e) => (
                <li key={e} className="font-mono">
                  {e}
                </li>
              ))}
              {emails.length > 5 && (
                <li className="text-fg-muted">... 외 {emails.length - 5}명</li>
              )}
            </ul>
            {/* v0.113b F66: label 이 input 을 참조하도록 htmlFor + id 연결. 보조기술이 두
                필드를 구분할 수 있게. UI_SYSTEM label semantics 규약 준수. */}
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="bulk-reset-password-new-input"
                  className="text-small text-fg-primary block mb-1"
                >
                  새 비밀번호 (최소 8자)
                </label>
                <input
                  id="bulk-reset-password-new-input"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  data-testid="bulk-reset-password-new"
                  className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
                />
              </div>
              <div>
                <label
                  htmlFor="bulk-reset-password-confirm-input"
                  className="text-small text-fg-primary block mb-1"
                >
                  비밀번호 확인
                </label>
                <input
                  id="bulk-reset-password-confirm-input"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  data-testid="bulk-reset-password-confirm"
                  className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
                />
              </div>
              <label className="flex items-center gap-2 text-small text-fg-primary">
                <input
                  type="checkbox"
                  checked={changePasswordAtNextLogin}
                  onChange={(e) => setChangePasswordAtNextLogin(e.target.checked)}
                  data-testid="bulk-reset-password-force-change"
                />
                다음 로그인 시 사용자가 비밀번호를 반드시 변경하도록 강제
              </label>
              {validationError && (
                <p
                  className="text-small text-state-danger"
                  data-testid="bulk-reset-password-validation-error"
                >
                  {validationError}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                취소
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={
                  newPassword.length < 8 ||
                  confirmPassword.length < 8 ||
                  emails.length === 0
                }
                data-testid="bulk-reset-password-confirm-btn"
              >
                {emails.length}명 비밀번호 변경
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === 'running' && (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>비밀번호 일괄 변경 진행 중</DialogTitle>
              <DialogDescription>계정 비밀번호를 변경하고 있습니다.</DialogDescription>
            </DialogHeader>
            <div className="py-8 text-center space-y-3" data-testid="bulk-reset-password-running">
              <div className="text-body text-fg-primary">
                진행 중: <strong className="font-mono">{progress}</strong> /{' '}
                <strong className="font-mono">{emails.length}</strong>
              </div>
              <div className="w-full bg-canvas h-2 border border-border-subtle">
                <div
                  className="bg-fg-primary h-full transition-all"
                  style={{
                    width: `${emails.length > 0 ? (progress / emails.length) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </>
        )}

        {phase === 'done' && (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>비밀번호 일괄 변경 완료</DialogTitle>
              <DialogDescription>일괄 변경 작업이 완료되었습니다.</DialogDescription>
            </DialogHeader>
            <div data-testid="bulk-reset-password-done" className="space-y-3">
              <p className="text-body text-fg-primary">
                완료:{' '}
                <strong className="text-state-success font-mono">
                  {emails.length - failures.length}
                </strong>
                명 성공
                {failures.length > 0 && (
                  <>
                    {' · '}
                    <strong className="text-state-danger font-mono">
                      {failures.length}
                    </strong>
                    명 실패
                  </>
                )}
              </p>
              {failures.length > 0 && (
                <ul
                  className="text-small text-state-danger space-y-1 max-h-40 overflow-y-auto"
                  data-testid="bulk-reset-password-failures"
                >
                  {failures.map((f) => (
                    <li key={f.email}>
                      <span className="font-mono">{f.email}</span>: {f.message}
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
