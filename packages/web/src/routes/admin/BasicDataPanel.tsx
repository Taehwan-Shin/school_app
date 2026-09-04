import { useState } from 'react';
import { useBasicDataGet } from '../../api/basicDataGet';
import { Button } from '../../components/ui/button';
import { EditBasicDataDialog } from './EditBasicDataDialog';

export function BasicDataPanel() {
  const currentYear = new Date().getFullYear();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const { data, isLoading, isError, error } = useBasicDataGet(currentYear);

  return (
    <section className="bg-elevated p-8 border border-border-subtle space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-h2 font-semibold text-fg-primary">기초값 관리</h2>
          <p className="text-small text-fg-secondary mt-1">
            연도별 학년·반 구조. 그룹·클래스룸 생성 시 참조됩니다.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-small text-fg-secondary">
            연도: <strong className="font-mono text-fg-primary">{currentYear}</strong>
          </div>
          <Button
            variant="secondary"
            onClick={() => setIsEditOpen(true)}
            data-testid="basic-data-edit-btn"
          >
            편집
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="py-8 text-center text-small text-fg-secondary" data-testid="basic-data-loading">
          불러오는 중...
        </div>
      )}

      {isError && (
        <div className="border border-state-danger p-4 text-small text-state-danger" data-testid="basic-data-error">
          기초값을 불러오지 못했습니다: {error?.message || '알 수 없는 오류'}
        </div>
      )}

      {!isLoading && !isError && !data?.data && (
        <div className="py-8 text-center text-small text-fg-secondary" data-testid="basic-data-empty">
          {currentYear}년 기초값이 아직 설정되지 않았습니다.
        </div>
      )}

      {data?.data && (
        <div className="space-y-3" data-testid="basic-data-content">
          {data.data.grades.map((g) => (
            <div key={g.grade} className="flex items-baseline gap-4">
              <div className="text-body font-semibold text-fg-primary w-16">
                {g.grade}학년
              </div>
              <div className="flex flex-wrap gap-2">
                {g.classes.map((c) => (
                  <span
                    key={c}
                    className="px-2 py-1 border border-border-subtle bg-canvas text-small font-mono text-fg-primary"
                    data-testid={`basic-data-class-${g.grade}-${c}`}
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {data.data.updatedAt && (
            <p className="text-micro text-fg-muted pt-2 border-t border-border-subtle">
              최근 수정: {new Date(data.data.updatedAt).toLocaleString('ko-KR')}
              {data.data.updatedBy && <> · <span className="font-mono">{data.data.updatedBy}</span></>}
            </p>
          )}
        </div>
      )}

      <EditBasicDataDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        year={currentYear}
        initialData={data?.data ?? null}
      />
    </section>
  );
}
