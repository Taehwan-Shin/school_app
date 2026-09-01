import { useState, useEffect, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { useUpdateUser, type UsersUpdateRequest } from "../../api/usersUpdate";

export interface EditUserTarget {
  email: string;
  firstName: string;
  lastName: string;
  orgUnitPath: string;
}

export interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: EditUserTarget | null;
}

export function EditUserDialog({ open, onOpenChange, user }: EditUserDialogProps) {
  const [familyName, setFamilyName] = useState(user?.lastName || "");
  const [givenName, setGivenName] = useState(user?.firstName || "");
  const [orgUnitPath, setOrgUnitPath] = useState(user?.orgUnitPath || "/");
  const [validationError, setValidationError] = useState<string | null>(null);

  const { mutateAsync: updateUser, isPending, error: mutationError } = useUpdateUser();

  useEffect(() => {
    if (user) {
      setFamilyName(user.lastName);
      setGivenName(user.firstName);
      setOrgUnitPath(user.orgUnitPath || "/");
      setValidationError(null);
    }
  }, [user]);

  const resetForm = () => {
    if (user) {
      setFamilyName(user.lastName);
      setGivenName(user.firstName);
      setOrgUnitPath(user.orgUnitPath || "/");
    } else {
      setFamilyName("");
      setGivenName("");
      setOrgUnitPath("/");
    }
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

    if (!user) return;

    if (!familyName.trim()) {
      setValidationError("성을 입력해주세요.");
      return;
    }

    if (!givenName.trim()) {
      setValidationError("이름을 입력해주세요.");
      return;
    }

    const normalizedOrg = orgUnitPath.trim() || "/";
    const userOrg = user.orgUnitPath || "/";

    if (
      familyName.trim() === user.lastName &&
      givenName.trim() === user.firstName &&
      normalizedOrg === userOrg
    ) {
      setValidationError("변경된 내용이 없습니다.");
      return;
    }

    const payload: UsersUpdateRequest = { primaryEmail: user.email };
    if (familyName.trim() !== user.lastName) payload.lastName = familyName.trim();
    if (givenName.trim() !== user.firstName) payload.firstName = givenName.trim();
    if (normalizedOrg !== userOrg) payload.orgUnitPath = normalizedOrg;

    try {
      await updateUser(payload);
      handleClose(false);
    } catch {
      // Mutation error handled below
    }
  };

  const errorMessage =
    validationError ||
    (mutationError
      ? mutationError.message.includes("admin_cannot_edit_admin")
        ? "관리자 계정은 다른 관리자가 수정할 수 없습니다."
        : mutationError.message.includes("permission-denied")
        ? "계정 수정 권한이 없거나 스코프가 부족합니다."
        : mutationError.message.includes("no_fields_to_update")
        ? "변경된 내용이 없습니다."
        : `계정 수정 실패: ${mutationError.message}`
      : null);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle>사용자 편집</DialogTitle>
            <DialogDescription>
              사용자 이름과 조직 단위를 수정합니다
            </DialogDescription>
          </DialogHeader>

          {errorMessage && (
            <div
              className="border border-state-danger p-3 text-small text-state-danger"
              data-testid="edit-user-error"
            >
              {errorMessage}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-small text-fg-secondary mb-1 block">
                이메일
              </label>
              <div
                className="font-mono text-body text-fg-primary bg-surface px-3 py-2 border border-border-subtle"
                data-testid="edit-user-email"
              >
                {user?.email || ""}
              </div>
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
            <Button
              type="submit"
              variant="default"
              disabled={isPending}
              data-testid="edit-user-submit"
            >
              {isPending ? "저장 중..." : "저장"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
