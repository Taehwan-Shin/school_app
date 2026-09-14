// v0.145: 나이스 CSV 파싱 (원본 Apps Script `createAndInviteClassrooms` 대응).
//
// 3개 CSV 를 원본 시트 스키마 그대로 파싱:
// 1. classroom.csv (`1.클래스룸생성&초대`):
//    - C1 (row 0 col 2) = ownerEmail (헤더 위 메타).
//    - row 4+ (index 3+) = 데이터. E(4)=subjectClass, F(5)=courseName, G(6)=만들기,
//      H(7)=classroomId (output).
// 2. teachers.csv (`교사과목정리`):
//    - row 1+ (index 1+) = 데이터. B(1)=subjectClass, G(6)=이메일.
// 3. students.csv (`학생과목정리`):
//    - row 1+ (index 1+) = 데이터. B(1)=subjectClass, K(10)=이메일.
//
// papaparse 로 raw 2D 배열 파싱 (header 옵션 없이) · 위 인덱스로 접근.

import Papa from 'papaparse';

export interface ClassroomRow {
  rowIndex: number; // 원본 CSV 상의 1-based 행 번호 (사용자 안내용).
  subjectClass: string;
  courseName: string;
  create: boolean; // G열 TRUE/FALSE.
  existingClassroomId?: string; // H열 값 (이미 만든 것 표시용).
}

export interface TeacherRow {
  subjectClass: string;
  email: string;
}

export interface StudentRow {
  subjectClass: string;
  email: string;
}

export interface ClassroomCsvParsed {
  ownerEmail: string; // C1.
  rows: ClassroomRow[];
}

export interface TeacherCsvParsed {
  rows: TeacherRow[];
}

export interface StudentCsvParsed {
  rows: StudentRow[];
}

// papaparse 결과를 2D string 배열로 정규화 (header 옵션 없이).
function parseCsvRaw(text: string): string[][] {
  const res = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: false,
  });
  if (res.errors.length > 0) {
    const first = res.errors[0];
    throw new Error(`CSV 파싱 실패: ${first.message} (row ${first.row ?? '?'})`);
  }
  return res.data.map((r) => r.map((c) => (typeof c === 'string' ? c : String(c ?? ''))));
}

export function parseClassroomCsv(text: string): ClassroomCsvParsed {
  const grid = parseCsvRaw(text);
  const ownerEmail = (grid[0]?.[2] ?? '').trim();
  const rows: ClassroomRow[] = [];
  // 원본 startRow=4 → 1-based 4 = 0-based index 3.
  for (let i = 3; i < grid.length; i++) {
    const row = grid[i];
    if (!row || row.every((c) => !c || c.trim() === '')) continue;
    const subjectClass = (row[4] ?? '').trim();
    const courseName = (row[5] ?? '').trim();
    const createFlag = (row[6] ?? '').trim().toUpperCase();
    const existingClassroomId = (row[7] ?? '').trim() || undefined;
    if (!subjectClass && !courseName) continue;
    rows.push({
      rowIndex: i + 1,
      subjectClass,
      courseName,
      create: createFlag === 'TRUE',
      existingClassroomId,
    });
  }
  return { ownerEmail, rows };
}

export function parseTeacherCsv(text: string): TeacherCsvParsed {
  const grid = parseCsvRaw(text);
  const rows: TeacherRow[] = [];
  // 원본은 `index > 0` (0-based) 로 헤더 skip.
  for (let i = 1; i < grid.length; i++) {
    const row = grid[i];
    if (!row) continue;
    const subjectClass = (row[1] ?? '').trim();
    const email = (row[6] ?? '').trim();
    if (!subjectClass || !email) continue;
    rows.push({ subjectClass, email });
  }
  return { rows };
}

export function parseStudentCsv(text: string): StudentCsvParsed {
  const grid = parseCsvRaw(text);
  const rows: StudentRow[] = [];
  for (let i = 1; i < grid.length; i++) {
    const row = grid[i];
    if (!row) continue;
    const subjectClass = (row[1] ?? '').trim();
    const email = (row[10] ?? '').trim();
    if (!subjectClass || !email) continue;
    rows.push({ subjectClass, email });
  }
  return { rows };
}

export interface PlanRow {
  rowIndex: number;
  subjectClass: string;
  courseName: string;
  teacherCount: number;
  studentCount: number;
}

// classroom rows (create=true) + teachers + students 를 합쳐 실행 계획 생성.
export function buildPlan(
  classroom: ClassroomCsvParsed,
  teachers: TeacherCsvParsed,
  students: StudentCsvParsed,
): { plan: PlanRow[]; totals: { create: number; teachers: number; students: number } } {
  const teacherIndex = new Map<string, TeacherRow[]>();
  for (const t of teachers.rows) {
    const list = teacherIndex.get(t.subjectClass) ?? [];
    list.push(t);
    teacherIndex.set(t.subjectClass, list);
  }
  const studentIndex = new Map<string, StudentRow[]>();
  for (const s of students.rows) {
    const list = studentIndex.get(s.subjectClass) ?? [];
    list.push(s);
    studentIndex.set(s.subjectClass, list);
  }
  const plan: PlanRow[] = [];
  let teachersTotal = 0;
  let studentsTotal = 0;
  for (const c of classroom.rows) {
    if (!c.create) continue;
    const teacherCount = teacherIndex.get(c.subjectClass)?.length ?? 0;
    const studentCount = studentIndex.get(c.subjectClass)?.length ?? 0;
    plan.push({
      rowIndex: c.rowIndex,
      subjectClass: c.subjectClass,
      courseName: c.courseName,
      teacherCount,
      studentCount,
    });
    teachersTotal += teacherCount;
    studentsTotal += studentCount;
  }
  return {
    plan,
    totals: { create: plan.length, teachers: teachersTotal, students: studentsTotal },
  };
}

// subjectClass 로 매칭된 이메일 리스트 반환 (실행 시).
export function teachersFor(subjectClass: string, teachers: TeacherCsvParsed): string[] {
  return teachers.rows.filter((t) => t.subjectClass === subjectClass).map((t) => t.email);
}

export function studentsFor(subjectClass: string, students: StudentCsvParsed): string[] {
  return students.rows.filter((s) => s.subjectClass === subjectClass).map((s) => s.email);
}
