import { useState, useEffect, useCallback, type FormEvent } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { useClassroomCreate } from '../../api/classroomCreate';
import type { ClassroomCourse } from '../../api/classroomList';
import {
  EMAIL_DOMAIN,
  EMAIL_LOCAL_PART_MAX,
  extractEmailLocalPart,
  normalizeSchoolEmailInput,
  previewSchoolEmail,
} from '../../lib/emailInput';
import { courseStateOptionLabel } from '../../lib/courseState';
import {
  COURSE_DESCRIPTION_MAX,
  COURSE_NAME_MAX,
  COURSE_ROOM_MAX,
  COURSE_SECTION_MAX,
} from '../../lib/classroomLimits';

export interface CreateClassroomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (course: ClassroomCourse) => void;
}

export function CreateClassroomDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateClassroomDialogProps) {
  const [name, setName] = useState('');
  const [section, setSection] = useState('');
  const [description, setDescription] = useState('');
  const [room, setRoom] = useState('');
  const [ownerId, setOwnerId] = useState('me');
  const [ownerValidationError, setOwnerValidationError] = useState<string | null>(null);
  const [courseState, setCourseState] = useState<'PROVISIONED' | 'ACTIVE'>('PROVISIONED');

  const {
    mutateAsync: createClassroom,
    isPending,
    error: mutationError,
    reset: resetMutation,
  } = useClassroomCreate();

  // v0.142b: useCallback([resetMutation]) 로 안정 참조 (Codex 지적 · react-query
  // reset 은 observer stable bind). setter 들은 React 가 이미 stable 보장.
  const resetForm = useCallback(() => {
    setName('');
    setSection('');
    setDescription('');
    setRoom('');
    setOwnerId('me');
    setOwnerValidationError(null);
    setCourseState('PROVISIONED');
    resetMutation?.();
  }, [resetMutation]);

  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open, resetForm]);

  const handleOpenChange = (newOpen: boolean) => {
    if (isPending) return;
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  // v0.168: 'me' 특수 값 · local-part → 자동 @cam.hs.kr · full email 뒤호환.
  const resolveOwnerId = (raw: string): string | null => {
    const trimmed = raw.trim();
    if (!trimmed) return 'me';
    if (trimmed.toLowerCase() === 'me') return 'me';
    return normalizeSchoolEmailInput(trimmed);
  };

  const [descriptionValidationError, setDescriptionValidationError] = useState<string | null>(null);
  const [fieldLengthError, setFieldLengthError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isPending) return;

    setOwnerValidationError(null);
    setDescriptionValidationError(null);
    setFieldLengthError(null);

    if (name.length > COURSE_NAME_MAX) {
      setFieldLengthError(
        `이름은 최대 ${COURSE_NAME_MAX.toLocaleString()}자까지 입력할 수 있습니다. (현재 ${name.length.toLocaleString()}자)`,
      );
      return;
    }
    if (section.length > COURSE_SECTION_MAX) {
      setFieldLengthError(
        `섹션은 최대 ${COURSE_SECTION_MAX.toLocaleString()}자까지 입력할 수 있습니다. (현재 ${section.length.toLocaleString()}자)`,
      );
      return;
    }
    if (room.length > COURSE_ROOM_MAX) {
      setFieldLengthError(
        `강의실은 최대 ${COURSE_ROOM_MAX.toLocaleString()}자까지 입력할 수 있습니다. (현재 ${room.length.toLocaleString()}자)`,
      );
      return;
    }

    if (description.length > COURSE_DESCRIPTION_MAX) {
      setDescriptionValidationError(
        `설명은 최대 ${COURSE_DESCRIPTION_MAX.toLocaleString()}자까지 입력할 수 있습니다. (현재 ${description.length.toLocaleString()}자)`,
      );
      return;
    }

    const resolvedOwner = resolveOwnerId(ownerId);
    if (!resolvedOwner) {
      setOwnerValidationError(
        `소유자는 「me」 · 아이디 (예: teacher-a) · 또는 @${EMAIL_DOMAIN} 도메인의 전체 이메일이어야 합니다.`,
      );
      return;
    }

    try {
      const res = await createClassroom({
        name: name.trim(),
        section: section.trim() || undefined,
        description: description.trim() || undefined,
        room: room.trim() || undefined,
        ownerId: resolvedOwner,
        courseState,
      });
      onOpenChange(false);
      onSuccess?.(res.course);
    } catch {
      // Error handled by mutationError
    }
  };

  // v0.168: preview — 'me' 는 그대로, local-part 는 @cam.hs.kr 부착, invalid 는 없음.
  const ownerPreview = (() => {
    const trimmed = ownerId.trim();
    if (!trimmed || trimmed.toLowerCase() === 'me') return '';
    return previewSchoolEmail(trimmed);
  })();

  const errorMessage = mutationError
    ? mutationError.message.includes('permission-denied')
      ? '코스 생성 권한이 없거나 스코프가 부족합니다.'
      : `코스 생성 실패: ${mutationError.message}`
    : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        onPointerDownOutside={(e) => {
          if (isPending) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (isPending) e.preventDefault();
        }}
      >
        <form
          onSubmit={handleSubmit}
          className="space-y-6"
          data-testid="create-classroom-form"
        >
          <DialogHeader>
            <DialogTitle className="text-h2 font-bold text-fg-primary">
              새 클래스룸 코스 생성
            </DialogTitle>
            <DialogDescription>
              Google Classroom 코스를 생성합니다. 필수 항목을 입력해주세요.
            </DialogDescription>
          </DialogHeader>

          {errorMessage && (
            <div
              className="border border-state-danger p-3 text-small text-state-danger"
              data-testid="create-classroom-error"
            >
              {errorMessage}
            </div>
          )}

          {fieldLengthError && (
            <div
              className="border border-state-danger p-3 text-small text-state-danger"
              data-testid="create-classroom-field-length-error"
            >
              {fieldLengthError}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="courseName" className="text-small text-fg-secondary mb-1 block">
                코스 이름 *
              </label>
              <input
                id="courseName"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 2026학년도 1학년 1반 수학"
                data-testid="create-classroom-name"
                className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
              />
              <p
                className={`mt-1 text-small ${
                  name.length > COURSE_NAME_MAX ? 'text-state-danger' : 'text-fg-muted'
                }`}
                data-testid="create-classroom-name-counter"
              >
                {name.length.toLocaleString()} / {COURSE_NAME_MAX.toLocaleString()} 자
              </p>
            </div>

            <div>
              <label htmlFor="courseSection" className="text-small text-fg-secondary mb-1 block">
                섹션
              </label>
              <input
                id="courseSection"
                type="text"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                placeholder="예: 1학기 (선택)"
                data-testid="create-classroom-section"
                className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
              />
              <p
                className={`mt-1 text-small ${
                  section.length > COURSE_SECTION_MAX ? 'text-state-danger' : 'text-fg-muted'
                }`}
                data-testid="create-classroom-section-counter"
              >
                {section.length.toLocaleString()} / {COURSE_SECTION_MAX.toLocaleString()} 자
              </p>
            </div>

            <div>
              <label htmlFor="courseDescription" className="text-small text-fg-secondary mb-1 block">
                설명
              </label>
              <textarea
                id="courseDescription"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="코스에 대한 설명 (선택)"
                data-testid="create-classroom-description"
                className="w-full resize-y border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
              />
              {/* v0.188: v0.180 name counter 스타일로 통일 (text-micro → text-small, text-red-600 → text-state-danger, 「현재」 prefix 제거). */}
              <p
                className={`mt-1 text-small ${
                  description.length > COURSE_DESCRIPTION_MAX
                    ? 'text-state-danger'
                    : 'text-fg-muted'
                }`}
                data-testid="create-classroom-description-counter"
              >
                {description.length.toLocaleString()} / {COURSE_DESCRIPTION_MAX.toLocaleString()} 자
              </p>
              {descriptionValidationError && (
                <p
                  className="mt-1 text-micro text-state-danger"
                  data-testid="create-classroom-description-error"
                >
                  {descriptionValidationError}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="courseRoom" className="text-small text-fg-secondary mb-1 block">
                강의실
              </label>
              <input
                id="courseRoom"
                type="text"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="예: 301호 (선택)"
                data-testid="create-classroom-room"
                className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
              />
              <p
                className={`mt-1 text-small ${
                  room.length > COURSE_ROOM_MAX ? 'text-state-danger' : 'text-fg-muted'
                }`}
                data-testid="create-classroom-room-counter"
              >
                {room.length.toLocaleString()} / {COURSE_ROOM_MAX.toLocaleString()} 자
              </p>
            </div>

            <div>
              <label htmlFor="courseOwner" className="text-small text-fg-secondary mb-1 block">
                소유자 <span className="text-fg-muted">(「me」 또는 아이디 · 자동 @{EMAIL_DOMAIN})</span>
              </label>
              <input
                id="courseOwner"
                type="text"
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                placeholder="me 또는 teacher-a"
                data-testid="create-classroom-owner"
                className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
              />
              {ownerPreview && (
                <p
                  className="mt-1 text-micro text-fg-muted"
                  data-testid="create-classroom-owner-preview"
                >
                  미리보기: <span className="font-mono">{ownerPreview}</span>
                </p>
              )}
              {/* v0.192: owner local-part 64자 카운터. 「me」 또는 빈 값이면 미노출. */}
              {(() => {
                const trimmed = ownerId.trim();
                if (trimmed === '' || trimmed === 'me') return null;
                const local = extractEmailLocalPart(trimmed);
                if (local.length === 0) return null;
                return (
                  <p
                    className={`mt-1 text-small ${
                      local.length > EMAIL_LOCAL_PART_MAX
                        ? 'text-state-danger'
                        : 'text-fg-muted'
                    }`}
                    data-testid="create-classroom-owner-local-counter"
                  >
                    이메일 아이디 {local.length} / {EMAIL_LOCAL_PART_MAX} 자
                  </p>
                );
              })()}
              {ownerValidationError && (
                <p
                  className="mt-1 text-micro text-state-danger"
                  data-testid="create-classroom-owner-error"
                >
                  {ownerValidationError}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="courseState" className="text-small text-fg-secondary mb-1 block">
                상태
              </label>
              <select
                id="courseState"
                value={courseState}
                onChange={(e) => setCourseState(e.target.value as 'PROVISIONED' | 'ACTIVE')}
                data-testid="create-classroom-state"
                className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
              >
                <option value="PROVISIONED">{courseStateOptionLabel('PROVISIONED')}</option>
                <option value="ACTIVE">{courseStateOptionLabel('ACTIVE')}</option>
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              취소
            </Button>
            <Button
              type="submit"
              variant="default"
              disabled={isPending || !name.trim()}
              data-testid="create-classroom-submit"
            >
              {isPending ? '생성 중...' : '생성'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
