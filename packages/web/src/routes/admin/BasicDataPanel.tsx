import { useState, useEffect } from 'react';
import { useBasicDataGet } from '../../api/basicDataGet';
import { useBasicDataListYears } from '../../api/basicDataListYears';
import { Button } from '../../components/ui/button';
import { EditBasicDataDialog } from './EditBasicDataDialog';
import { AutoCreateGroupsDialog } from './AutoCreateGroupsDialog';
import { AutoCreateDepartmentGroupsDialog } from './AutoCreateDepartmentGroupsDialog';
import { EditRostersDialog } from './EditRostersDialog';

export function BasicDataPanel() {
  const thisYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(thisYear);
  const [yearInput, setYearInput] = useState(String(thisYear));
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAutoCreateOpen, setIsAutoCreateOpen] = useState(false);
  const [isAutoCreateDeptOpen, setIsAutoCreateDeptOpen] = useState(false);
  const [isRostersEditOpen, setIsRostersEditOpen] = useState(false);

  useEffect(() => {
    const parsed = Number.parseInt(yearInput, 10);
    if (Number.isFinite(parsed) && parsed >= 1900 && parsed <= 2200) {
      setSelectedYear(parsed);
    }
  }, [yearInput]);

  const { data, isLoading, isError, error } = useBasicDataGet(selectedYear);
  const { data: yearsData } = useBasicDataListYears();
  const savedYears = yearsData?.years ?? [];

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
          <div className="flex items-center gap-2">
            <label className="text-small text-fg-secondary" htmlFor="basic-data-year-input">연도:</label>
            {savedYears.length > 0 && (
              <select
                value={savedYears.includes(selectedYear) ? String(selectedYear) : ''}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) setYearInput(v);
                }}
                data-testid="basic-data-year-select"
                className="border border-border-subtle bg-canvas px-2 py-1 text-body font-mono text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
              >
                <option value="">-- 저장된 연도 --</option>
                {savedYears.map((y) => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </select>
            )}
            <input
              id="basic-data-year-input"
              type="number"
              min={1900}
              max={2200}
              value={yearInput}
              onChange={(e) => setYearInput(e.target.value)}
              data-testid="basic-data-year-input"
              className="w-20 border border-border-subtle bg-canvas px-2 py-1 text-body font-mono text-fg-primary text-center focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
            />
          </div>
          <Button
            variant="secondary"
            onClick={() => setIsAutoCreateOpen(true)}
            data-testid="basic-data-auto-create-groups-btn"
            disabled={!data?.data || (data.data.grades ?? []).length === 0}
            title={!data?.data ? '기초값 먼저 설정하세요' : '학년/반으로 그룹 자동 생성'}
          >
            그룹 자동 생성
          </Button>
          <Button
            variant="secondary"
            onClick={() => setIsAutoCreateDeptOpen(true)}
            data-testid="basic-data-auto-create-dept-groups-btn"
            disabled={!data?.data?.departments || data.data.departments.length === 0}
            title={
              !data?.data?.departments || data.data.departments.length === 0
                ? '부서를 먼저 추가하세요'
                : '부서로 그룹 자동 생성'
            }
          >
            부서 그룹 자동 생성
          </Button>
          <Button
            variant="secondary"
            onClick={() => setIsRostersEditOpen(true)}
            data-testid="basic-data-rosters-edit-btn"
            disabled={!data?.data || (data.data.grades ?? []).length === 0}
            title={!data?.data ? '기초값 먼저 설정하세요' : '반별 학생 명단 편집'}
          >
            학생 명단 편집
          </Button>
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
          {selectedYear}년 기초값이 아직 설정되지 않았습니다.
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
                {g.classes.map((c) => {
                  const rosterCount = data.data?.rosters?.[String(g.grade)]?.[c]?.length ?? 0;
                  return (
                    <span
                      key={c}
                      className="px-2 py-1 border border-border-subtle bg-canvas text-small font-mono text-fg-primary"
                      data-testid={`basic-data-class-${g.grade}-${c}`}
                    >
                      {c}
                      {rosterCount > 0 && (
                        <span className="ml-1 text-fg-muted text-micro">({rosterCount})</span>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
          {data.data.departments && data.data.departments.length > 0 && (
            <div className="pt-4 border-t border-border-subtle" data-testid="basic-data-departments">
              <div className="text-micro uppercase tracking-wide text-fg-secondary mb-2">부서</div>
              <div className="flex flex-wrap gap-2">
                {data.data.departments.map((d) => (
                  <span
                    key={d}
                    className="px-2 py-1 border border-border-subtle bg-canvas text-small text-fg-primary"
                    data-testid={`basic-data-department-${d}`}
                  >
                    {d}
                  </span>
                ))}
              </div>
            </div>
          )}
          {data.data.updatedAt && (
            <p className="text-micro text-fg-muted pt-2 border-t border-border-subtle">
              최근 수정: {new Date(data.data.updatedAt).toLocaleString('ko-KR')}
              {data.data.updatedBy && <> · <span className="font-mono">{data.data.updatedBy}</span></>}
            </p>
          )}
        </div>
      )}

      {data?.data && (
        <AutoCreateGroupsDialog
          open={isAutoCreateOpen}
          onOpenChange={setIsAutoCreateOpen}
          year={selectedYear}
          grades={data.data.grades}
        />
      )}

      {data?.data?.departments && (
        <AutoCreateDepartmentGroupsDialog
          open={isAutoCreateDeptOpen}
          onOpenChange={setIsAutoCreateDeptOpen}
          year={selectedYear}
          departments={data.data.departments}
        />
      )}

      {data?.data && (
        <EditRostersDialog
          open={isRostersEditOpen}
          onOpenChange={setIsRostersEditOpen}
          year={selectedYear}
          initialData={data.data}
        />
      )}

      <EditBasicDataDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        year={selectedYear}
        initialData={data?.data ?? null}
      />
    </section>
  );
}
