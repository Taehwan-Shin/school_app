import { describe, it, expect } from 'vitest';
import {
  parseClassroomCsv,
  parseTeacherCsv,
  parseStudentCsv,
  buildPlan,
  teachersFor,
  studentsFor,
} from '../src/routes/admin/neisCsvParse';

// v0.145: 원본 Apps Script 컬럼 인덱스 스키마 대응.
// classroom: C1=owner, row 4+ (index 3+) E/F/G/H.
// teacher: row 2+ (index 1+) B/G.
// student: row 2+ (index 1+) B/K.

describe('neisCsvParse.parseClassroomCsv', () => {
  it('C1 에서 owner 를 뽑고 row 4+ 만 데이터로 인식', () => {
    // 4 열은 A/B/C/D · C 는 index 2 이므로 3 개 컬럼 앞 채운 뒤 owner.
    const csv = [
      // row 1: 헤더 위 메타. C1 = owner.
      'meta,,owner@school.kr,,,,,,,,,',
      'header,header,header,header,header,header,header,header',
      'header,header,header,header,header,header,header,header',
      // row 4+ 데이터. E=subjectClass, F=courseName, G=만들기, H=classroomId.
      ',,,,수학-1반,1학년 1반 수학,TRUE,',
      ',,,,영어-1반,1학년 1반 영어,FALSE,',
      ',,,,국어-1반,1학년 1반 국어,true,c-exist',
    ].join('\n');
    const res = parseClassroomCsv(csv);
    expect(res.ownerEmail).toBe('owner@school.kr');
    expect(res.rows).toHaveLength(3);
    expect(res.rows[0].subjectClass).toBe('수학-1반');
    expect(res.rows[0].courseName).toBe('1학년 1반 수학');
    expect(res.rows[0].create).toBe(true);
    expect(res.rows[1].create).toBe(false);
    // 원본은 uppercase 비교 → 'true' 도 인식.
    expect(res.rows[2].create).toBe(true);
    expect(res.rows[2].existingClassroomId).toBe('c-exist');
  });

  it('빈 row 는 스킵 · trim 적용', () => {
    const csv = [
      ',,,,,,',
      ',,,,',
      ',,,,',
      ',,,,  수학-1반  ,  코스 A  ,TRUE,',
      ',,,,,',
    ].join('\n');
    const res = parseClassroomCsv(csv);
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].subjectClass).toBe('수학-1반');
    expect(res.rows[0].courseName).toBe('코스 A');
  });

  it('owner 미지정 CSV → ownerEmail 빈 문자열', () => {
    const csv = [',,,,,', ',,,,,', ',,,,,', ',,,,수학-1반,코스,TRUE,'].join('\n');
    const res = parseClassroomCsv(csv);
    expect(res.ownerEmail).toBe('');
    expect(res.rows).toHaveLength(1);
  });
});

describe('neisCsvParse.parseTeacherCsv', () => {
  it('row 2+ 만 · B=subjectClass, G=email', () => {
    const csv = [
      'name,subject,x,y,z,w,email',
      '홍길동,수학-1반,,,,,teacher1@school.kr',
      '김철수,영어-1반,,,,,teacher2@school.kr',
      '이영희,수학-1반,,,,,teacher3@school.kr',
    ].join('\n');
    const res = parseTeacherCsv(csv);
    expect(res.rows).toHaveLength(3);
    expect(res.rows[0]).toEqual({ subjectClass: '수학-1반', email: 'teacher1@school.kr' });
    expect(res.rows[1]).toEqual({ subjectClass: '영어-1반', email: 'teacher2@school.kr' });
  });

  it('email 빈 row 는 스킵', () => {
    const csv = ['header,subject,,,,,email', ',수학-1반,,,,,', ',영어-1반,,,,,t@x.kr'].join('\n');
    const res = parseTeacherCsv(csv);
    expect(res.rows).toHaveLength(1);
  });
});

describe('neisCsvParse.parseStudentCsv', () => {
  it('row 2+ · B=subjectClass, K=email (index 10)', () => {
    const csv = [
      'name,subject,x1,x2,x3,x4,x5,x6,x7,x8,email',
      '학생1,수학-1반,,,,,,,,,s1@school.kr',
      '학생2,수학-1반,,,,,,,,,s2@school.kr',
      '학생3,영어-1반,,,,,,,,,s3@school.kr',
    ].join('\n');
    const res = parseStudentCsv(csv);
    expect(res.rows).toHaveLength(3);
    expect(res.rows[0]).toEqual({ subjectClass: '수학-1반', email: 's1@school.kr' });
    expect(res.rows[2]).toEqual({ subjectClass: '영어-1반', email: 's3@school.kr' });
  });
});

describe('neisCsvParse.buildPlan + teachersFor/studentsFor', () => {
  const classroom = {
    ownerEmail: 'o@school.kr',
    rows: [
      { rowIndex: 4, subjectClass: '수학-1반', courseName: '수학 1반', create: true },
      { rowIndex: 5, subjectClass: '영어-1반', courseName: '영어 1반', create: false },
      { rowIndex: 6, subjectClass: '국어-1반', courseName: '국어 1반', create: true },
    ],
  };
  const teachers = {
    rows: [
      { subjectClass: '수학-1반', email: 't-math-a@x.kr' },
      { subjectClass: '수학-1반', email: 't-math-b@x.kr' },
      { subjectClass: '영어-1반', email: 't-eng@x.kr' },
      { subjectClass: '국어-1반', email: 't-kor@x.kr' },
    ],
  };
  const students = {
    rows: [
      { subjectClass: '수학-1반', email: 's-math-1@x.kr' },
      { subjectClass: '수학-1반', email: 's-math-2@x.kr' },
      { subjectClass: '수학-1반', email: 's-math-3@x.kr' },
      { subjectClass: '국어-1반', email: 's-kor@x.kr' },
    ],
  };

  it('create=true row 만 plan 에 포함 · 매칭 카운트 정확', () => {
    const { plan, totals } = buildPlan(classroom, teachers, students);
    expect(plan).toHaveLength(2);
    expect(plan[0]).toMatchObject({
      subjectClass: '수학-1반',
      courseName: '수학 1반',
      teacherCount: 2,
      studentCount: 3,
    });
    expect(plan[1]).toMatchObject({
      subjectClass: '국어-1반',
      teacherCount: 1,
      studentCount: 1,
    });
    // 영어-1반 은 create=false 라 plan 없음.
    expect(totals).toEqual({ create: 2, teachers: 3, students: 4 });
  });

  it('teachersFor / studentsFor 는 subjectClass 로 이메일 리스트 반환', () => {
    expect(teachersFor('수학-1반', teachers)).toEqual(['t-math-a@x.kr', 't-math-b@x.kr']);
    expect(studentsFor('수학-1반', students)).toEqual([
      's-math-1@x.kr',
      's-math-2@x.kr',
      's-math-3@x.kr',
    ]);
    expect(teachersFor('없는-반', teachers)).toEqual([]);
  });
});
