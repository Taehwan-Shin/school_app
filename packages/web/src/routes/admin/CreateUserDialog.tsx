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
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Google Workspace 계정 추가</DialogTitle>
            <DialogDescription>
              새 사용자의 기본 정보를 입력하여 Google Workspace 계정을 생성합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {errorMessage && (
              <div
                className="p-3 text-sm rounded bg-red-50 border border-red-200 text-red-700"
                data-testid="create-user-error"
              >
                {errorMessage}
              </div>
            )}

            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="primaryEmail" className="text-right text-sm font-medium text-slate-700">
                이메일 *
              </label>
              <input
                id="primaryEmail"
                type="email"
                required
                value={primaryEmail}
                onChange={(e) => setPrimaryEmail(e.target.value)}
                placeholder="user@cam.hs.kr"
                className="col-span-3 h-9 px-3 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="familyName" className="text-right text-sm font-medium text-slate-700">
                성 *
              </label>
              <input
                id="familyName"
                type="text"
                required
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                placeholder="홍"
                className="col-span-3 h-9 px-3 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="givenName" className="text-right text-sm font-medium text-slate-700">
                이름 *
              </label>
              <input
                id="givenName"
                type="text"
                required
                value={givenName}
                onChange={(e) => setGivenName(e.target.value)}
                placeholder="길동"
                className="col-span-3 h-9 px-3 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="password" className="text-right text-sm font-medium text-slate-700">
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
                className="col-span-3 h-9 px-3 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="orgUnitPath" className="text-right text-sm font-medium text-slate-700">
                조직 단위
              </label>
              <input
                id="orgUnitPath"
                type="text"
                value={orgUnitPath}
                onChange={(e) => setOrgUnitPath(e.target.value)}
                placeholder="/학생/1학년"
                className="col-span-3 h-9 px-3 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={isPending}
            >
              취소
            </Button>
            <Button type="submit" disabled={isPending} data-testid="create-user-submit">
              {isPending ? "생성 중..." : "저장"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
