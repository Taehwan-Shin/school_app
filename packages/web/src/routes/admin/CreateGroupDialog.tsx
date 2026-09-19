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

// v0.167: BatchCreateUsersDialog v0.132 대칭 UX. local-part 입력 (아이디만) →
// 자동으로 @cam.hs.kr 붙여서 서버에 전송. 전체 이메일 입력도 뒤호환.
const EMAIL_DOMAIN = "cam.hs.kr";
// Google Workspace local-part 규칙: 알파벳/숫자/`.`/`_`/`-` 만, 64자 이하.
const LOCAL_PART_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const FULL_EMAIL_RE = new RegExp(
  `^[A-Za-z0-9][A-Za-z0-9._-]{0,63}@${EMAIL_DOMAIN.replace(/\./g, "\\.")}$`,
);

// 입력값을 canonical (lower-case + @cam.hs.kr) email 로 정규화. 부적합하면 null.
// 대소문자는 인식만 case-insensitive 로 하고 저장은 lower-case canonical.
export function normalizeGroupEmailInput(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;
  // @ 없으면 local-part 로 간주.
  if (!trimmed.includes("@")) {
    if (!LOCAL_PART_RE.test(trimmed)) return null;
    return `${trimmed}@${EMAIL_DOMAIN}`;
  }
  // @ 있으면 full email — 도메인 일치 + local-part 규칙 만족해야 함.
  if (!FULL_EMAIL_RE.test(trimmed)) return null;
  return trimmed;
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

    const trimmedRaw = email.trim();
    if (!trimmedRaw) {
      setValidationError("이메일 (아이디) 를 입력해주세요.");
      return;
    }
    // v0.167: local-part 입력 시 @cam.hs.kr 자동 부착. full email 도 뒤호환.
    const canonicalEmail = normalizeGroupEmailInput(trimmedRaw);
    if (!canonicalEmail) {
      setValidationError(
        `이메일 형식이 올바르지 않습니다. 아이디만 입력하거나 @${EMAIL_DOMAIN} 도메인의 전체 이메일을 입력해주세요.`,
      );
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      setValidationError("이름을 입력해주세요.");
      return;
    }

    try {
      await createGroup({
        email: canonicalEmail,
        name: trimmedName,
        description: description.trim() || undefined,
      });
      handleClose(false);
    } catch {
      // Mutation error handled below
    }
  };

  // v0.167: 실시간 preview — local-part 입력 시 <input>@cam.hs.kr 표시.
  const previewEmail = (() => {
    const trimmed = email.trim();
    if (!trimmed) return "";
    if (trimmed.includes("@")) return trimmed.toLowerCase();
    if (!LOCAL_PART_RE.test(trimmed)) return "";
    return `${trimmed.toLowerCase()}@${EMAIL_DOMAIN}`;
  })();

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
                이메일 아이디 * <span className="text-fg-muted">(자동 @{EMAIL_DOMAIN})</span>
              </label>
              <input
                id="groupEmail"
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="team-a"
                data-testid="create-group-email-input"
                className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
              />
              {previewEmail && (
                <p
                  className="mt-1 text-micro text-fg-muted"
                  data-testid="create-group-email-preview"
                >
                  미리보기: <span className="font-mono">{previewEmail}</span>
                </p>
              )}
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
