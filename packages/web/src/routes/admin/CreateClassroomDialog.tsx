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
import { useClassroomCreate } from '../../api/classroomCreate';
import type { ClassroomCourse } from '../../api/classroomList';

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
  const [courseState, setCourseState] = useState<'PROVISIONED' | 'ACTIVE'>('PROVISIONED');

  const {
    mutateAsync: createClassroom,
    isPending,
    error: mutationError,
    reset: resetMutation,
  } = useClassroomCreate();

  const resetForm = () => {
    setName('');
    setSection('');
    setDescription('');
    setRoom('');
    setOwnerId('me');
    setCourseState('PROVISIONED');
    resetMutation?.();
  };

  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open]);

  const handleOpenChange = (newOpen: boolean) => {
    if (isPending) return;
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isPending) return;

    try {
      const res = await createClassroom({
        name: name.trim(),
        section: section.trim() || undefined,
        description: description.trim() || undefined,
        room: room.trim() || undefined,
        ownerId: ownerId.trim() || 'me',
        courseState,
      });
      onOpenChange(false);
      onSuccess?.(res.course);
    } catch {
      // Error handled by mutationError
    }
  };

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
                className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
              />
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
            </div>

            <div>
              <label htmlFor="courseOwner" className="text-small text-fg-secondary mb-1 block">
                소유자
              </label>
              <input
                id="courseOwner"
                type="text"
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                placeholder="me"
                data-testid="create-classroom-owner"
                className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
              />
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
                <option value="PROVISIONED">PROVISIONED</option>
                <option value="ACTIVE">ACTIVE</option>
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
