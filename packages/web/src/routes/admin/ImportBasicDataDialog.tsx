import { useState, useEffect } from 'react';
import type { BasicDataYear } from '@school-app/shared';
import { isValidBasicDataYear } from '@school-app/shared';
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

export interface ImportBasicDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentYear: number;
  onDone?: () => void;
}

type Phase = 'select' | 'preview' | 'saving' | 'done';

export function ImportBasicDataDialog({
  open,
  onOpenChange,
  currentYear,
  onDone,
}: ImportBasicDataDialogProps) {
  const [phase, setPhase] = useState<Phase>('select');
  const [parsedData, setParsedData] = useState<BasicDataYear | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { mutateAsync: saveBasicData } = useBasicDataSet();

  useEffect(() => {
    if (open) {
      setPhase('select');
      setParsedData(null);
      setParseError(null);
      setSaveError(null);
    }
  }, [open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result as string;
        const obj = JSON.parse(text);
        if (!isValidBasicDataYear(obj)) {
          setParseError('JSON 이 basic_data 스키마와 일치하지 않습니다.');
          setParsedData(null);
          return;
        }
        setParsedData(obj as BasicDataYear);
        setPhase('preview');
      } catch (err) {
        setParseError(`JSON 파싱 실패: ${(err as Error).message}`);
        setParsedData(null);
      }
    };
    reader.readAsText(file);
  };

  const handleSave = async () => {
    if (!parsedData) return;
    setPhase('saving');
    setSaveError(null);
    try {
      await saveBasicData({
        year: parsedData.year,
        grades: parsedData.grades,
        ...(parsedData.departments !== undefined ? { departments: parsedData.departments } : {}),
        ...(parsedData.rosters !== undefined ? { rosters: parsedData.rosters } : {}),
      });
      setPhase('done');
    } catch (err) {
      setSaveError((err as Error).message);
      setPhase('preview');
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (phase === 'saving') return;
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={phase === 'saving' ? '[&>button]:hidden space-y-4' : 'space-y-4'}>
        {phase === 'select' && (
          <>
            <DialogHeader>
              <DialogTitle>basic_data JSON 불러오기</DialogTitle>
              <DialogDescription>
                JSON 파일을 선택하세요. 스키마 검증 후 미리보기 표시 -&gt; 확인 시 해당 연도 전체 덮어쓰기.
              </DialogDescription>
            </DialogHeader>
            <input
              type="file"
              accept="application/json,.json"
              onChange={handleFileChange}
              data-testid="import-basic-data-file-input"
              className="block w-full text-body text-fg-primary file:mr-4 file:py-2 file:px-4 file:border file:border-border-subtle file:bg-canvas file:text-fg-primary file:cursor-pointer"
            />
            {parseError && (
              <div
                className="border border-state-danger p-4 text-small text-state-danger"
                data-testid="import-basic-data-parse-error"
              >
                {parseError}
              </div>
            )}
            <DialogFooter>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                취소
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === 'preview' && (
          <>
            <DialogHeader>
              <DialogTitle>미리보기</DialogTitle>
              <DialogDescription>
                아래 데이터로 <strong className="font-mono">{parsedData?.year}</strong>년 기초값을 전체 덮어씁니다.
                {parsedData?.year !== currentYear && (
                  <span className="text-state-warning ml-2">
                    (현재 편집 중 연도 {currentYear} 와 다릅니다)
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <div
              className="grid grid-cols-2 md:grid-cols-4 gap-2 text-small text-fg-secondary"
              data-testid="import-basic-data-preview"
            >
              <div>
                학년: <strong className="font-mono text-fg-primary">{parsedData?.grades.length ?? 0}</strong>
              </div>
              <div>
                반:{' '}
                <strong className="font-mono text-fg-primary">
                  {parsedData?.grades.reduce((s, g) => s + g.classes.length, 0) ?? 0}
                </strong>
              </div>
              <div>
                학생:{' '}
                <strong className="font-mono text-fg-primary">
                  {Object.values(parsedData?.rosters ?? {}).reduce(
                    (sum, grade) => sum + Object.values(grade).reduce((s, arr) => s + arr.length, 0),
                    0
                  )}
                </strong>
              </div>
              <div>
                부서:{' '}
                <strong className="font-mono text-fg-primary">
                  {parsedData?.departments?.length ?? 0}
                </strong>
              </div>
            </div>
            {saveError && (
              <div
                className="border border-state-danger p-4 text-small text-state-danger"
                data-testid="import-basic-data-save-error"
              >
                저장 실패: {saveError}
              </div>
            )}
            <DialogFooter>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                취소
              </Button>
              <Button onClick={handleSave} data-testid="import-basic-data-save-btn">
                덮어쓰기 실행
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === 'saving' && (
          <div className="py-8 text-center text-body text-fg-primary" data-testid="import-basic-data-saving">
            저장 중...
          </div>
        )}

        {phase === 'done' && (
          <div className="py-8 text-center space-y-3" data-testid="import-basic-data-done">
            <p className="text-body text-state-success">
              <strong className="font-mono">{parsedData?.year}</strong>년 기초값을 성공적으로 저장했습니다.
            </p>
            <DialogFooter>
              <Button
                onClick={() => {
                  onOpenChange(false);
                  onDone?.();
                }}
              >
                확인
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
