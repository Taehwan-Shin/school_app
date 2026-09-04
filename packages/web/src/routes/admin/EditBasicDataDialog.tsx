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
import type { BasicDataGradeClass, BasicDataYear } from '@school-app/shared';

export interface EditBasicDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
  initialData: BasicDataYear | null;
}

interface GradeRow {
  grade: string;
  classesText: string;
}

export function EditBasicDataDialog({
  open,
  onOpenChange,
  year,
  initialData,
}: EditBasicDataDialogProps) {
  const [rows, setRows] = useState<GradeRow[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const { mutateAsync: saveBasicData, isPending, error: mutationError } = useBasicDataSet();

  useEffect(() => {
    if (open) {
      if (initialData?.grades && initialData.grades.length > 0) {
        setRows(
          initialData.grades.map((g) => ({
            grade: String(g.grade),
            classesText: g.classes.join(', '),
          })),
        );
      } else {
        setRows([{ grade: '1', classesText: '' }]);
      }
      setValidationError(null);
    }
  }, [open, initialData]);

  const handleAddRow = () => {
    setRows((prev) => {
      const last = prev[prev.length - 1];
      const lastGrade = last ? Number.parseInt(last.grade.trim(), 10) : 0;
      const nextGrade =
        Number.isFinite(lastGrade) && lastGrade > 0 ? lastGrade + 1 : prev.length + 1;
      return [...prev, { grade: String(nextGrade), classesText: '' }];
    });
  };

  const handleRemoveRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const grades: BasicDataGradeClass[] = [];
    for (const r of rows) {
      const gradeNum = Number.parseInt(r.grade.trim(), 10);
      if (!Number.isFinite(gradeNum)) {
        setValidationError('학년은 숫자여야 합니다.');
        return;
      }
      const classes = r.classesText
        .split(',')
        .map((c) => c.trim())
        .filter((c) => c.length > 0);
      if (classes.length === 0) {
        setValidationError(`${gradeNum}학년에 반이 없습니다.`);
        return;
      }
      grades.push({ grade: gradeNum, classes });
    }

    if (grades.length === 0) {
      setValidationError('최소 한 학년은 필요합니다.');
      return;
    }

    try {
      await saveBasicData({ year, grades });
      onOpenChange(false);
    } catch {
      // mutationError 는 아래 표시
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle>{year}년 기초값 편집</DialogTitle>
            <DialogDescription>
              학년 및 반 구조를 설정합니다. 반은 쉼표(,)로 구분하여 입력하세요.
            </DialogDescription>
          </DialogHeader>

          {validationError && (
            <div
              className="border border-state-danger p-4 text-small text-state-danger"
              data-testid="edit-basic-data-validation-error"
            >
              {validationError}
            </div>
          )}
          {mutationError && (
            <div
              className="border border-state-danger p-4 text-small text-state-danger"
              data-testid="edit-basic-data-error"
            >
              저장 실패: {mutationError.message}
            </div>
          )}

          <div className="space-y-3">
            {rows.map((row, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="flex items-center gap-2 w-28">
                  <label htmlFor={`grade-${idx}`} className="text-small text-fg-secondary shrink-0">
                    학년
                  </label>
                  <input
                    id={`grade-${idx}`}
                    type="number"
                    value={row.grade}
                    onChange={(e) => {
                      const updated = [...rows];
                      updated[idx] = { ...updated[idx], grade: e.target.value };
                      setRows(updated);
                    }}
                    className="w-full border border-border-subtle bg-canvas px-2 py-1.5 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong font-mono"
                    data-testid={`edit-basic-data-grade-${idx}`}
                  />
                </div>
                <div className="flex-1 flex items-center gap-2">
                  <label htmlFor={`classes-${idx}`} className="text-small text-fg-secondary shrink-0">
                    반
                  </label>
                  <input
                    id={`classes-${idx}`}
                    type="text"
                    placeholder="1, 2, 3 또는 A, B, C"
                    value={row.classesText}
                    onChange={(e) => {
                      const updated = [...rows];
                      updated[idx] = { ...updated[idx], classesText: e.target.value };
                      setRows(updated);
                    }}
                    className="w-full border border-border-subtle bg-canvas px-3 py-1.5 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
                    data-testid={`edit-basic-data-classes-${idx}`}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveRow(idx)}
                  data-testid={`edit-basic-data-remove-${idx}`}
                  aria-label={`${row.grade || idx + 1}학년 제거`}
                >
                  ✕
                </Button>
              </div>
            ))}

            <div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleAddRow}
                data-testid="edit-basic-data-add"
              >
                + 학년 추가
              </Button>
            </div>
          </div>

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
              variant="default"
              disabled={isPending}
              data-testid="edit-basic-data-submit"
            >
              {isPending ? '저장 중...' : '저장'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
