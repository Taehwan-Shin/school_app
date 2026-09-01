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
import { useUpdateGroup, type GroupsUpdateRequest } from "../../api/groupsUpdate";

export interface EditGroupTarget {
  email: string; // 읽기 전용
  name: string;
  description: string;
}

export interface EditGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: EditGroupTarget | null;
}

export function EditGroupDialog({ open, onOpenChange, group }: EditGroupDialogProps) {
  const [name, setName] = useState(group?.name || "");
  const [description, setDescription] = useState(group?.description || "");
  const [validationError, setValidationError] = useState<string | null>(null);

  const { mutateAsync: updateGroup, isPending, error: mutationError } = useUpdateGroup();

  useEffect(() => {
    if (group) {
      setName(group.name);
      setDescription(group.description || "");
      setValidationError(null);
    }
  }, [group]);

  const resetForm = () => {
    if (group) {
      setName(group.name);
      setDescription(group.description || "");
    } else {
      setName("");
      setDescription("");
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

    if (!group) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setValidationError("이름을 입력해주세요.");
      return;
    }

    const trimmedDesc = description.trim();
    const groupDesc = (group.description || "").trim();

    if (trimmedName === group.name.trim() && trimmedDesc === groupDesc) {
      setValidationError("변경된 내용이 없습니다.");
      return;
    }

    const payload: GroupsUpdateRequest = { email: group.email };
    if (trimmedName !== group.name.trim()) {
      payload.name = trimmedName;
    }
    if (trimmedDesc !== groupDesc) {
      payload.description = trimmedDesc;
    }

    try {
      await updateGroup(payload);
      handleClose(false);
    } catch {
      // Mutation error handled below
    }
  };

  const errorMessage =
    validationError ||
    (mutationError
      ? mutationError.message.includes("permission-denied")
        ? "그룹 편집 권한이 없습니다."
        : mutationError.message.includes("no_fields_to_update")
        ? "변경된 내용이 없습니다."
        : `그룹 편집 실패: ${mutationError.message}`
      : null);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle>그룹 편집</DialogTitle>
            <DialogDescription>
              그룹 이름과 설명을 수정합니다
            </DialogDescription>
          </DialogHeader>

          {errorMessage && (
            <div
              className="border border-state-danger p-3 text-small text-state-danger"
              data-testid="edit-group-error"
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
                data-testid="edit-group-email"
              >
                {group?.email || ""}
              </div>
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
                placeholder="그룹 설명"
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
              data-testid="edit-group-submit"
            >
              {isPending ? "저장 중..." : "저장"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
