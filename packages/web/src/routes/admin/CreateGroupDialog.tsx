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
import { useCreateGroup } from "../../api/groupsCreate";

export interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateGroupDialog({ open, onOpenChange }: CreateGroupDialogProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const { mutateAsync: createGroup, isPending, error: mutationError } = useCreateGroup();

  const resetForm = () => {
    setEmail("");
    setName("");
    setDescription("");
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

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setValidationError("이메일을 입력해주세요.");
      return;
    }

    if (!trimmedEmail.endsWith("@cam.hs.kr")) {
      setValidationError("이메일은 @cam.hs.kr 도메인이어야 합니다.");
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      setValidationError("이름을 입력해주세요.");
      return;
    }

    try {
      await createGroup({
        email: trimmedEmail,
        name: trimmedName,
        description: description.trim() || undefined,
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
        ? "그룹 생성 권한이 없거나 스코프가 부족합니다."
        : mutationError.message.includes("invalid_email_domain")
        ? "허용되지 않는 이메일 도메인입니다."
        : `그룹 생성 실패: ${mutationError.message}`
      : null);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle>Google Workspace 그룹 추가</DialogTitle>
            <DialogDescription>
              새 그룹의 기본 정보를 입력하여 Google Workspace 그룹을 생성합니다.
            </DialogDescription>
          </DialogHeader>

          {errorMessage && (
            <div
              className="border border-state-danger p-3 text-small text-state-danger"
              data-testid="create-group-error"
            >
              {errorMessage}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="groupEmail" className="text-small text-fg-secondary mb-1 block">
                이메일 *
              </label>
              <input
                id="groupEmail"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="team-a@cam.hs.kr"
                className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
              />
            </div>

            <div>
              <label htmlFor="groupName" className="text-small text-fg-secondary mb-1 block">
                이름 *
              </label>
              <input
                id="groupName"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="그룹 이름"
                className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
              />
            </div>

            <div>
              <label htmlFor="groupDescription" className="text-small text-fg-secondary mb-1 block">
                설명
              </label>
              <input
                id="groupDescription"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="그룹 설명 (선택)"
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
              data-testid="create-group-submit"
            >
              {isPending ? "생성 중..." : "저장"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
