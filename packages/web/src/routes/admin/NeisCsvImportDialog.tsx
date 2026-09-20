// v0.145: 나이스 CSV 3 파일 업로드 → 파싱 → preview → 일괄 클래스룸 생성 + 교사/학생 초대.
// 원본 Apps Script `createAndInviteClassrooms` 웹 포팅.

import { useState, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { callClassroomCreate } from '../../api/classroomCreate';
import { callClassroomTeachersAdd } from '../../api/classroomTeachersAdd';
import { callClassroomStudentsAdd } from '../../api/classroomStudentsAdd';
import {
  parseClassroomCsv,
  parseTeacherCsv,
  parseStudentCsv,
  buildPlan,
  teachersFor,
  studentsFor,
  type ClassroomCsvParsed,
  type TeacherCsvParsed,
  type StudentCsvParsed,
  type PlanRow,
} from './neisCsvParse';
import { useQueryClient } from '@tanstack/react-query';
import { COURSE_NAME_MAX } from '../../lib/classroomLimits';

export interface NeisCsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Phase = 'select' | 'preview' | 'running' | 'done';

interface ExecResult {
  rowIndex: number;
  courseName: string;
  courseId?: string;
  ok: boolean;
  message?: string;
  teachersAdded: number;
  teachersFailed: number;
  studentsAdded: number;
  studentsFailed: number;
}

// v0.182: 상한 초과 row 집계 (COURSE_NAME_MAX=750, v0.175 shared 상수). 순수 함수로
// 뽑아 회귀 테스트에서 직접 검증.
export function findOverlyLongPlanRows(
  plan: Array<{ rowIndex: number; courseName: string }>,
  max: number = COURSE_NAME_MAX,
): Array<{ rowIndex: number; courseName: string }> {
  return plan.filter((p) => p.courseName.length > max);
}

async function readFileText(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('file_read_failed'));
    reader.readAsText(file, 'utf-8');
  });
}

export function NeisCsvImportDialog({ open, onOpenChange }: NeisCsvImportDialogProps) {
  const qc = useQueryClient();
  const [phase, setPhase] = useState<Phase>('select');
  const [classroomCsv, setClassroomCsv] = useState<ClassroomCsvParsed | null>(null);
  const [teacherCsv, setTeacherCsv] = useState<TeacherCsvParsed | null>(null);
  const [studentCsv, setStudentCsv] = useState<StudentCsvParsed | null>(null);
  const [classroomError, setClassroomError] = useState<string | null>(null);
  const [teacherError, setTeacherError] = useState<string | null>(null);
  const [studentError, setStudentError] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanRow[]>([]);
  const [totals, setTotals] = useState({ create: 0, teachers: 0, students: 0 });
  const [results, setResults] = useState<ExecResult[]>([]);
  const [progress, setProgress] = useState(0);

  const resetAll = useCallback(() => {
    setPhase('select');
    setClassroomCsv(null);
    setTeacherCsv(null);
    setStudentCsv(null);
    setClassroomError(null);
    setTeacherError(null);
    setStudentError(null);
    setPlan([]);
    setTotals({ create: 0, teachers: 0, students: 0 });
    setResults([]);
    setProgress(0);
  }, []);

  const handleClose = (next: boolean) => {
    if (!next && phase === 'running') return;
    if (!next) resetAll();
    onOpenChange(next);
  };

  const handleFileChange = async (
    kind: 'classroom' | 'teacher' | 'student',
    file: File | null,
  ) => {
    if (!file) return;
    try {
      const text = await readFileText(file);
      if (kind === 'classroom') {
        setClassroomError(null);
        setClassroomCsv(parseClassroomCsv(text));
      } else if (kind === 'teacher') {
        setTeacherError(null);
        setTeacherCsv(parseTeacherCsv(text));
      } else {
        setStudentError(null);
        setStudentCsv(parseStudentCsv(text));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (kind === 'classroom') setClassroomError(msg);
      else if (kind === 'teacher') setTeacherError(msg);
      else setStudentError(msg);
    }
  };

  const canPreview =
    classroomCsv !== null && teacherCsv !== null && studentCsv !== null;

  // v0.182: 코스 이름 상한 (COURSE_NAME_MAX=750) 초과 row 감지 (v0.176 BulkRename 패턴).
  // preview 단계에서 사용자에게 미리 경고 · 실행 차단.
  const overlyLongRows = useMemo(() => findOverlyLongPlanRows(plan), [plan]);
  const canExecute = plan.length > 0 && overlyLongRows.length === 0;

  const handleBuildPreview = () => {
    if (!classroomCsv || !teacherCsv || !studentCsv) return;
    const { plan: p, totals: t } = buildPlan(classroomCsv, teacherCsv, studentCsv);
    setPlan(p);
    setTotals(t);
    setPhase('preview');
  };

  const handleExecute = async () => {
    if (!classroomCsv || !teacherCsv || !studentCsv) return;
    setPhase('running');
    setProgress(0);
    const collected: ExecResult[] = [];
    // Owner: CSV C1 우선 · 없으면 'me'.
    const ownerId = classroomCsv.ownerEmail || 'me';

    for (let i = 0; i < plan.length; i++) {
      const row = plan[i];
      let courseId: string | undefined;
      let ok = false;
      let message: string | undefined;
      let teachersAdded = 0;
      let teachersFailed = 0;
      let studentsAdded = 0;
      let studentsFailed = 0;
      try {
        const res = await callClassroomCreate({
          name: row.courseName,
          ownerId,
          courseState: 'ACTIVE',
        });
        courseId = res.course.id;
        ok = true;
      } catch (err) {
        message = err instanceof Error ? err.message : String(err);
      }
      if (ok && courseId) {
        const teachers = teachersFor(row.subjectClass, teacherCsv);
        for (const email of teachers) {
          try {
            await callClassroomTeachersAdd({ courseId, userId: email });
            teachersAdded += 1;
          } catch {
            teachersFailed += 1;
          }
        }
        const students = studentsFor(row.subjectClass, studentCsv);
        for (const email of students) {
          try {
            await callClassroomStudentsAdd({ courseId, userId: email });
            studentsAdded += 1;
          } catch {
            studentsFailed += 1;
          }
        }
      }
      collected.push({
        rowIndex: row.rowIndex,
        courseName: row.courseName,
        courseId,
        ok,
        message,
        teachersAdded,
        teachersFailed,
        studentsAdded,
        studentsFailed,
      });
      setProgress(i + 1);
    }
    setResults(collected);
    qc.invalidateQueries({ queryKey: ['classroom', 'list'] });
    setPhase('done');
  };

  const isBusy = phase === 'running';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>나이스 CSV 일괄 클래스룸 생성 + 초대</DialogTitle>
          <DialogDescription>
            3 CSV (클래스룸 생성 시트 · 교사과목정리 · 학생과목정리) 를 원본 Apps Script 스키마
            그대로 업로드하면 「만들기=TRUE」 로 표시된 코스만 생성 후 교사/학생을 순차 초대합니다.
          </DialogDescription>
        </DialogHeader>

        {phase === 'select' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="neis-classroom-csv"
                className="text-small text-fg-primary font-medium block"
              >
                1. 클래스룸 생성 CSV (`1.클래스룸생성&초대`)
              </label>
              <p className="text-small text-fg-muted">
                C1 = ownerEmail · row 4+ 데이터 · E=과목-반, F=코스이름, G=만들기(TRUE/FALSE).
              </p>
              <input
                id="neis-classroom-csv"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => handleFileChange('classroom', e.target.files?.[0] ?? null)}
                disabled={isBusy}
                data-testid="neis-classroom-csv-input"
                className="text-small text-fg-primary"
              />
              {classroomError && (
                <p className="text-small text-state-danger" data-testid="neis-classroom-csv-error">
                  {classroomError}
                </p>
              )}
              {classroomCsv && (
                <p className="text-small text-state-success" data-testid="neis-classroom-csv-summary">
                  파싱: {classroomCsv.rows.length}행 · owner={classroomCsv.ownerEmail || '(미지정 → me)'}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label
                htmlFor="neis-teacher-csv"
                className="text-small text-fg-primary font-medium block"
              >
                2. 교사과목정리 CSV
              </label>
              <p className="text-small text-fg-muted">row 2+ 데이터 · B=과목-반, G=교사 이메일.</p>
              <input
                id="neis-teacher-csv"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => handleFileChange('teacher', e.target.files?.[0] ?? null)}
                disabled={isBusy}
                data-testid="neis-teacher-csv-input"
                className="text-small text-fg-primary"
              />
              {teacherError && (
                <p className="text-small text-state-danger" data-testid="neis-teacher-csv-error">
                  {teacherError}
                </p>
              )}
              {teacherCsv && (
                <p className="text-small text-state-success" data-testid="neis-teacher-csv-summary">
                  파싱: {teacherCsv.rows.length}건.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label
                htmlFor="neis-student-csv"
                className="text-small text-fg-primary font-medium block"
              >
                3. 학생과목정리 CSV
              </label>
              <p className="text-small text-fg-muted">row 2+ 데이터 · B=과목-반, K=학생 이메일.</p>
              <input
                id="neis-student-csv"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => handleFileChange('student', e.target.files?.[0] ?? null)}
                disabled={isBusy}
                data-testid="neis-student-csv-input"
                className="text-small text-fg-primary"
              />
              {studentError && (
                <p className="text-small text-state-danger" data-testid="neis-student-csv-error">
                  {studentError}
                </p>
              )}
              {studentCsv && (
                <p className="text-small text-state-success" data-testid="neis-student-csv-summary">
                  파싱: {studentCsv.rows.length}건.
                </p>
              )}
            </div>
          </div>
        )}

        {phase === 'preview' && (
          <div className="space-y-4" data-testid="neis-preview">
            <div className="border border-border-subtle bg-elevated p-3 space-y-1">
              <p className="text-small text-fg-primary font-medium">실행 계획</p>
              <p className="text-small text-fg-secondary">
                생성: {totals.create}개 코스 · 교사 초대: {totals.teachers}건 · 학생 초대:{' '}
                {totals.students}건.
              </p>
              <p className="text-small text-fg-muted">
                Owner: {classroomCsv?.ownerEmail || '(미지정 → me 로 대체)'}.
              </p>
            </div>
            {plan.length === 0 ? (
              <p className="text-small text-fg-muted py-4" data-testid="neis-preview-empty">
                생성 대상이 없습니다. 클래스룸 CSV G열이 「TRUE」 인 행이 있는지 확인하세요.
              </p>
            ) : (
              <>
                {overlyLongRows.length > 0 && (
                  <div
                    className="border border-state-danger bg-canvas p-3 space-y-1"
                    data-testid="neis-preview-name-limit-warning"
                  >
                    <p className="text-small text-state-danger font-medium">
                      코스 이름 상한 초과 {overlyLongRows.length}개 행 — 실행 불가
                    </p>
                    <p className="text-small text-fg-muted">
                      Google Classroom `courses.name` 은 최대 {COURSE_NAME_MAX}자입니다. CSV 를 수정 후 다시 미리보기 하세요.
                    </p>
                  </div>
                )}
                <div className="max-h-96 overflow-y-auto border border-border-subtle bg-canvas">
                  <table className="w-full text-small">
                    <thead className="border-b border-border-subtle bg-surface">
                      <tr>
                        <th scope="col" className="p-2 text-left">row</th>
                        <th scope="col" className="p-2 text-left">과목-반</th>
                        <th scope="col" className="p-2 text-left">코스 이름</th>
                        <th scope="col" className="p-2 text-right">교사</th>
                        <th scope="col" className="p-2 text-right">학생</th>
                      </tr>
                    </thead>
                    <tbody data-testid="neis-preview-tbody">
                      {plan.map((p) => {
                        const tooLong = p.courseName.length > COURSE_NAME_MAX;
                        return (
                          <tr
                            key={p.rowIndex}
                            className={`border-b border-border-subtle last:border-0 ${
                              tooLong ? 'bg-canvas' : ''
                            }`}
                            data-testid={tooLong ? `neis-preview-row-toolong-${p.rowIndex}` : undefined}
                          >
                            <td className="p-2 font-mono text-fg-muted">{p.rowIndex}</td>
                            <td className="p-2 text-fg-primary">{p.subjectClass}</td>
                            <td
                              className={`p-2 ${tooLong ? 'text-state-danger' : 'text-fg-primary'}`}
                            >
                              {p.courseName}
                              {tooLong && (
                                <span className="ml-2 text-micro">
                                  ({p.courseName.length} / {COURSE_NAME_MAX} 자 초과)
                                </span>
                              )}
                            </td>
                            <td className="p-2 text-right font-mono">{p.teacherCount}</td>
                            <td className="p-2 text-right font-mono">{p.studentCount}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {phase === 'running' && (
          <div className="space-y-2" data-testid="neis-running">
            <p className="text-small text-fg-primary">
              실행 중... {progress} / {plan.length}
            </p>
            <div className="w-full h-2 bg-surface border border-border-subtle">
              <div
                className="h-full bg-fg-primary"
                style={{ width: `${plan.length > 0 ? (progress / plan.length) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {phase === 'done' && (
          <div className="space-y-3" data-testid="neis-done">
            <p className="text-small text-fg-primary">
              완료: {results.filter((r) => r.ok).length} / {results.length} 코스 생성
              성공.
            </p>
            <div className="max-h-96 overflow-y-auto border border-border-subtle bg-canvas">
              <table className="w-full text-small">
                <thead className="border-b border-border-subtle bg-surface">
                  <tr>
                    <th scope="col" className="p-2 text-left">row</th>
                    <th scope="col" className="p-2 text-left">코스 이름</th>
                    <th scope="col" className="p-2 text-left">결과</th>
                    <th scope="col" className="p-2 text-right">교사 (성공/실패)</th>
                    <th scope="col" className="p-2 text-right">학생 (성공/실패)</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr
                      key={r.rowIndex}
                      className="border-b border-border-subtle last:border-0"
                      data-testid={`neis-result-${r.rowIndex}`}
                    >
                      <td className="p-2 font-mono text-fg-muted">{r.rowIndex}</td>
                      <td className="p-2 text-fg-primary">{r.courseName}</td>
                      <td className="p-2">
                        {r.ok ? (
                          <span className="text-state-success" title={r.courseId}>
                            성공 ({r.courseId?.slice(0, 8)}...)
                          </span>
                        ) : (
                          <span className="text-state-danger">실패: {r.message}</span>
                        )}
                      </td>
                      <td className="p-2 text-right font-mono">
                        {r.teachersAdded} / {r.teachersFailed}
                      </td>
                      <td className="p-2 text-right font-mono">
                        {r.studentsAdded} / {r.studentsFailed}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <DialogFooter>
          {phase === 'select' && (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleClose(false)}
              >
                취소
              </Button>
              <Button
                type="button"
                onClick={handleBuildPreview}
                disabled={!canPreview}
                data-testid="neis-build-preview-btn"
              >
                미리보기
              </Button>
            </>
          )}
          {phase === 'preview' && (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPhase('select')}
              >
                뒤로
              </Button>
              <Button
                type="button"
                onClick={handleExecute}
                disabled={!canExecute}
                data-testid="neis-execute-btn"
                title={
                  overlyLongRows.length > 0
                    ? `코스 이름 상한 초과 ${overlyLongRows.length}개 행. CSV 수정 후 다시 미리보기.`
                    : undefined
                }
              >
                {plan.length}개 코스 생성 실행
              </Button>
            </>
          )}
          {phase === 'running' && (
            <Button type="button" variant="secondary" disabled>
              실행 중...
            </Button>
          )}
          {phase === 'done' && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleClose(false)}
              data-testid="neis-close-btn"
            >
              닫기
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
