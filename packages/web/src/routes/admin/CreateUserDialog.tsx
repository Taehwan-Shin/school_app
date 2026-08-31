import { useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { useCreateUser } from "../../api/usersCreate";

export interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateUserDialog({ open, onOpenChange }: CreateUserDialogProps) {
  const [primaryEmail, setPrimaryEmail] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [givenName, setGivenName] = useState("");
  const [password, setPassword] = useState("");
  const [orgUnitPath, setOrgUnitPath] = useState("/");
  const [validationError, setValidationError] = useState<string | null>(null);

  const { mutateAsync: createUser, isPending, error: mutationError } = useCreateUser();

  const resetForm = () => {
    setPrimaryEmail("");
    setFamilyName("");
    setGivenName("");
    setPassword("");
    setOrgUnitPath("/");
    setValidationError(null);
  };

  const handleClose = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const trimmedEmail = primaryEmail.trim();
    if (!trimmedEmail) {
      setValidationError("이메일을 입력해주세요.");
      return;
    }

    if (!trimmedEmail.endsWith("@cam.hs.kr")) {
      setValidationError("이메일은 @cam.hs.kr 도메인이어야 합니다.");
      return;
    }

    if (!familyName.trim()) {
      setValidationError("성을 입력해주세요.");
      return;
    }

    if (!givenName.trim()) {
      setValidationError("이름을 입력해주세요.");
      return;
    }

    if (!password || password.length < 8) {
      setValidationError("비밀번호는 최소 8자 이상이어야 합니다.");
      return;
    }

    try {
      await createUser({
        primaryEmail: trimmedEmail,
        familyName: familyName.trim(),
        givenName: givenName.trim(),
        password,
        orgUnitPath: orgUnitPath.trim() || "/",
        changePasswordAtNextLogin: true,
      });
      handleClose(false);
    } catch {
      // Mutation error handled below
    }
  };

  const errorMessage =
    validationError ||
    (mutationError
      ? mutationError.message.includes("permission-denied")
        ? "계정 생성 권한이 없거나 스코프가 부족합니다."
        : mutationError.message.includes("invalid_email_domain")
        ? "허용되지 않는 이메일 도메인입니다."
        : `계정 생성 실패: ${mutationError.message}`
      : null);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle>Google Workspace 계정 추가</DialogTitle>
            <DialogDescription>
              새 사용자의 기본 정보를 입력하여 Google Workspace 계정을 생성합니다.
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
                className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
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
                className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
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
                className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
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
                className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
              />
            </div>

            <div>
              <label htmlFor="orgUnitPath" className="text-small text-fg-secondary mb-1 block">
                조직 단위
              </label>
              <input
                id="orgUnitPath"
                type="text"
                value={orgUnitPath}
                onChange={(e) => setOrgUnitPath(e.target.value)}
                placeholder="/학생/1학년"
                className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleClose(false)}
              disabled={isPending}
            >
              취소
            </Button>
            <Button type="submit" variant="default" disabled={isPending} data-testid="create-user-submit">
              {isPending ? "생성 중..." : "저장"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

