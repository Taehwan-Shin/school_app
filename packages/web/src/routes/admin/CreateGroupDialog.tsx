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
import {
  EMAIL_DOMAIN,
  EMAIL_LOCAL_PART_MAX,
  extractEmailLocalPart,
  normalizeSchoolEmailInput,
  previewSchoolEmail,
} from "../../lib/emailInput";
import { GROUP_DESCRIPTION_MAX, GROUP_NAME_MAX } from "../../lib/groupLimits";

export interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// v0.167 → v0.168: local-part 자동 부착 helper 는 `lib/emailInput` 으로 승격.
// 하위 호환용 alias export (기존 테스트 · 다른 import 유지).
export const normalizeGroupEmailInput = normalizeSchoolEmailInput;

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

    // v0.180: name 60자 상한 (Workspace Directory groups.name 규격).
    if (trimmedName.length > GROUP_NAME_MAX) {
      setValidationError(
        `이름은 ${GROUP_NAME_MAX}자 이하여야 합니다. (현재 ${trimmedName.length}자)`,
      );
      return;
    }

    // v0.173: description 4096자 상한 (Workspace Directory 규격 · v0.166 대칭).
    if (description.length > GROUP_DESCRIPTION_MAX) {
      setValidationError(
        `설명은 ${GROUP_DESCRIPTION_MAX}자 이하여야 합니다. (현재 ${description.length}자)`,
      );
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

  // v0.167 → v0.168: preview 계산은 shared helper 로 위임.
  const previewEmail = previewSchoolEmail(email);

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
              {/* v0.192: local-part 64자 카운터 (v0.181/v0.191 대칭 · counter 통일). */}
              {(() => {
                const local = extractEmailLocalPart(email.trim());
                if (local.length === 0) return null;
                return (
                  <p
                    className={`mt-1 text-small ${
                      local.length > EMAIL_LOCAL_PART_MAX
                        ? "text-state-danger"
                        : "text-fg-muted"
                    }`}
                    data-testid="create-group-email-local-counter"
                  >
                    이메일 아이디 {local.length} / {EMAIL_LOCAL_PART_MAX} 자
                  </p>
                );
              })()}
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
              <p
                className={`mt-1 text-small ${
                  name.trim().length > GROUP_NAME_MAX ? "text-state-danger" : "text-fg-muted"
                }`}
                data-testid="create-group-name-counter"
              >
                {name.trim().length} / {GROUP_NAME_MAX} 자
              </p>
            </div>

            <div>
              <label htmlFor="groupDescription" className="text-small text-fg-secondary mb-1 block">
                설명 <span className="text-fg-muted">(선택 · 최대 {GROUP_DESCRIPTION_MAX}자)</span>
              </label>
              <textarea
                id="groupDescription"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="그룹 설명 (예: 2026학년도 3학년 5반 학생 그룹)"
                rows={3}
                data-testid="create-group-description-input"
                className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong resize-y"
              />
              <p
                className={`mt-1 text-small ${
                  description.length > GROUP_DESCRIPTION_MAX
                    ? 'text-state-danger'
                    : 'text-fg-muted'
                }`}
                data-testid="create-group-description-counter"
              >
                {description.length} / {GROUP_DESCRIPTION_MAX} 자
              </p>
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
