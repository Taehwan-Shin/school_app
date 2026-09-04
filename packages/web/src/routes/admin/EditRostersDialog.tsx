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
import { useBasicDataSet } from '../../api/basicDataSet';
import type { BasicDataYear } from '@school-app/shared';

export interface EditRostersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
  initialData: BasicDataYear;
}

export function EditRostersDialog({
  open,
  onOpenChange,
  year,
  initialData,
}: EditRostersDialogProps) {
  const [rosterTexts, setRosterTexts] = useState<Record<string, string>>({});
  const [validationError, setValidationError] = useState<string | null>(null);
  const { mutateAsync: saveBasicData, isPending, error: mutationError } = useBasicDataSet();

  useEffect(() => {
    if (open) {
      const texts: Record<string, string> = {};
      for (const g of initialData.grades ?? []) {
        for (const c of g.classes ?? []) {
          const key = `${g.grade}-${c}`;
          const students = initialData.rosters?.[String(g.grade)]?.[c] ?? [];
          texts[key] = students.join('\n');
        }
      }
      setRosterTexts(texts);
      setValidationError(null);
    }
  }, [open, initialData]);

  const handleSubmit = async (e?: FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    setValidationError(null);

    const rosters: Record<string, Record<string, string[]>> = {};
    for (const g of initialData.grades ?? []) {
      for (const c of g.classes ?? []) {
        const key = `${g.grade}-${c}`;
        const emails = (rosterTexts[key] ?? '')
          .split('\n')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        if (emails.length > 0) {
          if (!rosters[String(g.grade)]) rosters[String(g.grade)] = {};
          rosters[String(g.grade)][c] = emails;
        }
      }
    }

    try {
      await saveBasicData({
        year,
        grades: initialData.grades,
        ...(initialData.departments !== undefined ? { departments: initialData.departments } : {}),
        rosters,
      });
      onOpenChange(false);
    } catch {
      // Handled via mutationError displayed in UI
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle>{year}년 학생 명단 편집</DialogTitle>
            <DialogDescription>
              각 반의 학생 이메일을 한 줄에 하나씩 입력하세요. 빈 반은 저장 안 됨.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-96 overflow-y-auto space-y-4">
            {(initialData.grades ?? []).map((g) => (
              <div key={g.grade} className="space-y-2">
                <div className="text-body font-semibold text-fg-primary">{g.grade}학년</div>
                {(g.classes ?? []).map((c) => {
                  const key = `${g.grade}-${c}`;
                  const count = (rosterTexts[key] ?? '')
                    .split('\n')
                    .filter((s) => s.trim().length > 0).length;
                  return (
                    <div key={key} className="ml-4">
                      <label className="text-small text-fg-primary">
                        {c}반 <span className="text-fg-muted">({count}명)</span>
                      </label>
                      <textarea
                        value={rosterTexts[key] ?? ''}
                        onChange={(e) => setRosterTexts((prev) => ({ ...prev, [key]: e.target.value }))}
                        placeholder="student1@cam.hs.kr&#10;student2@cam.hs.kr"
                        data-testid={`edit-rosters-${g.grade}-${c}`}
                        rows={4}
                        className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body font-mono text-fg-primary placeholder:text-fg-muted focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong mt-1"
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {validationError && (
            <div className="border border-state-danger p-4 text-small text-state-danger" data-testid="edit-rosters-validation-error">
              {validationError}
            </div>
          )}

          {mutationError && (
            <div className="border border-state-danger p-4 text-small text-state-danger" data-testid="edit-rosters-error">
              저장 실패: {mutationError.message}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              data-testid="edit-rosters-submit"
            >
              {isPending ? '저장 중...' : '저장'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
