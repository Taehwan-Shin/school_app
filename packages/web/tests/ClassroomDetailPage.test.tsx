import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const mockUseAuth = vi.fn();
const mockUseClassroomList = vi.fn();

vi.mock('../src/lib/auth', () => ({
  useAuth: () => mockUseAuth(),
  signOut: vi.fn(),
}));

vi.mock('../src/lib/theme', () => ({
  useTheme: () => ({
    theme: 'light',
    toggleTheme: vi.fn(),
    setTheme: vi.fn(),
  }),
}));

vi.mock('../src/api/classroomList', () => ({
  useClassroomList: () => mockUseClassroomList(),
}));

vi.mock('../src/api/classroomTeachersList', () => ({
  useClassroomTeachersList: () => ({
    data: { teachers: [] },
    isLoading: false,
    isError: false,
    error: null,
  }),
}));

vi.mock('../src/api/classroomStudentsList', () => ({
  useClassroomStudentsList: () => ({
    data: { students: [] },
    isLoading: false,
    isError: false,
    error: null,
  }),
}));

const mockTeachersAddState = { isPending: false };
vi.mock('../src/api/classroomTeachersAdd', () => ({
  useClassroomTeachersAdd: () => ({
    mutateAsync: vi.fn(),
    get isPending() {
      return mockTeachersAddState.isPending;
    },
    error: null,
    reset: vi.fn(),
  }),
}));

vi.mock('../src/api/classroomTeachersDelete', () => ({
  useClassroomTeachersDelete: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
    reset: vi.fn(),
  }),
}));

vi.mock('../src/api/classroomStudentsAdd', () => ({
  useClassroomStudentsAdd: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
    reset: vi.fn(),
  }),
}));

vi.mock('../src/api/classroomStudentsDelete', () => ({
  useClassroomStudentsDelete: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
    reset: vi.fn(),
  }),
}));

vi.mock('../src/api/classroomDelete', () => ({
  useClassroomDelete: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  }),
}));

vi.mock('../src/api/classroomPatch', () => ({
  useClassroomPatch: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  }),
}));

vi.mock('../src/api/classroomTransferOwnership', () => ({
  useClassroomTransferOwnership: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
    reset: vi.fn(),
  }),
}));

vi.mock('../src/routes/admin/ClassroomBulkInviteDialog', () => ({
  ClassroomBulkInviteDialog: () => null,
}));

vi.mock('../src/api/basicDataGet', () => ({
  useBasicDataGet: () => ({
    data: { data: { year: 2026, grades: [], rosters: {} } },
    isLoading: false,
    isError: false,
    error: null,
  }),
}));

import { ClassroomDetailPage } from '../src/routes/admin/classroomDetail';

function renderDetailPage(courseId = 'c-101') {
  return render(
    <MemoryRouter initialEntries={[`/admin/classrooms/${encodeURIComponent(courseId)}`]}>
      <Routes>
        <Route path="/admin/classrooms/:id" element={<ClassroomDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ClassroomDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTeachersAddState.isPending = false;
    mockUseAuth.mockReturnValue({
      user: { email: 'admin@cam.hs.kr' },
      role: 'admin',
      loading: false,
    });
  });

  it('scenario 1: renders loading state while classroomList loads', () => {
    mockUseClassroomList.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    });

    renderDetailPage();

    expect(screen.getByTestId('classroom-detail-loading')).toBeDefined();
  });

  it('scenario 2: renders error message when classroomList fails', () => {
    mockUseClassroomList.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('network_failure'),
    });

    renderDetailPage();

    expect(screen.getByTestId('classroom-detail-error')).toBeDefined();
    expect(screen.getByText(/network_failure/)).toBeDefined();
  });

  it('scenario 3: renders not-found message when course is missing from list', () => {
    mockUseClassroomList.mockReturnValue({
      data: { courses: [{ id: 'c-999', name: '다른 코스', courseState: 'ACTIVE' }] },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderDetailPage('c-101');

    const notFound = screen.getByTestId('classroom-detail-not-found');
    expect(notFound.textContent).toContain('c-101');
  });

  it('scenario 4: renders course info and active actions for ACTIVE state', () => {
    mockUseClassroomList.mockReturnValue({
      data: {
        courses: [
          {
            id: 'c-101',
            name: '1학년 1반 수학',
            section: '1학기',
            courseState: 'ACTIVE',
            ownerId: 'owner-abc',
            alternateLink: 'https://classroom.google.com/c/c-101',
            description: '수학 기초 강의',
          },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderDetailPage('c-101');

    expect(screen.getByText('1학년 1반 수학')).toBeDefined();
    expect(screen.getByText('1학기')).toBeDefined();
    expect(screen.getByText('활성')).toBeDefined();
    expect(screen.getByText('owner-abc')).toBeDefined();
    expect(screen.getByText('수학 기초 강의')).toBeDefined();
    const link = screen.getByTestId('classroom-detail-link');
    expect(link.getAttribute('href')).toBe('https://classroom.google.com/c/c-101');

    const archiveBtn = screen.getByTestId('classroom-detail-archive-btn');
    expect(archiveBtn.textContent).toBe('아카이브');
    expect(screen.getByTestId('classroom-detail-delete-btn')).toBeDefined();

    // admin role은 소유자 이관 capability 가 있음
    expect(screen.getByTestId('classroom-detail-transfer-owner-btn')).toBeDefined();
  });

  it('scenario 5: ARCHIVED state hides transfer-owner button and shows 복구', () => {
    mockUseClassroomList.mockReturnValue({
      data: {
        courses: [
          {
            id: 'c-101',
            name: '1학년 1반 수학',
            courseState: 'ARCHIVED',
          },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderDetailPage('c-101');

    const archiveBtn = screen.getByTestId('classroom-detail-archive-btn');
    expect(archiveBtn.textContent).toBe('복구');
    expect(screen.queryByTestId('classroom-detail-transfer-owner-btn')).toBeNull();
  });

  it('scenario 6: PROVISIONED state hides archive and transfer buttons but keeps 삭제', () => {
    mockUseClassroomList.mockReturnValue({
      data: {
        courses: [
          {
            id: 'c-101',
            name: '1학년 1반 수학',
            courseState: 'PROVISIONED',
          },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderDetailPage('c-101');

    expect(screen.queryByTestId('classroom-detail-archive-btn')).toBeNull();
    expect(screen.queryByTestId('classroom-detail-transfer-owner-btn')).toBeNull();
    expect(screen.getByTestId('classroom-detail-delete-btn')).toBeDefined();
  });

  it('scenario 7: super_admin sees audit trail link', () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'root@cam.hs.kr' },
      role: 'super_admin',
      loading: false,
    });
    mockUseClassroomList.mockReturnValue({
      data: {
        courses: [{ id: 'c-101', name: '1학년 1반', courseState: 'ACTIVE' }],
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderDetailPage('c-101');

    const auditLink = screen.getByTestId('classroom-detail-audit-link');
    // v0.117b F80: audit 링크는 서버 filterTarget 을 태우는 target 파라미터로
    // `courses/<id>` 를 실어야 한다. 기존 q 파라미터는 message/action client 검색만
    // 커버해서 target 이력을 제대로 찾지 못했다.
    expect(auditLink.getAttribute('href')).toBe(
      `/super_admin/audit?target=${encodeURIComponent('courses/c-101')}`,
    );
  });

  it('scenario 8: teacher role does NOT see audit link (RoleGuard would block, this checks defensive UI)', () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'teacher@cam.hs.kr' },
      role: 'teacher',
      loading: false,
    });
    mockUseClassroomList.mockReturnValue({
      data: {
        courses: [{ id: 'c-101', name: '1학년 1반', courseState: 'ACTIVE' }],
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderDetailPage('c-101');

    expect(screen.queryByTestId('classroom-detail-audit-link')).toBeNull();
    // teacher 는 transfer_owner capability 없음
    expect(screen.queryByTestId('classroom-detail-transfer-owner-btn')).toBeNull();
  });

  it('scenario 9: renders back link to /admin/classrooms', () => {
    mockUseClassroomList.mockReturnValue({
      data: {
        courses: [{ id: 'c-101', name: '1학년 1반', courseState: 'ACTIVE' }],
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderDetailPage('c-101');

    const backBtn = screen.getByTestId('classroom-detail-back');
    expect(backBtn).toBeDefined();
    expect(backBtn.textContent).toContain('클래스룸 목록');
  });

  it('scenario 10: renders member panel with tabs', () => {
    mockUseClassroomList.mockReturnValue({
      data: {
        courses: [{ id: 'c-101', name: '1학년 1반', courseState: 'ACTIVE' }],
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderDetailPage('c-101');

    expect(screen.getByTestId('course-members-tab-teachers')).toBeDefined();
    expect(screen.getByTestId('course-members-tab-students')).toBeDefined();
    expect(screen.getByTestId('course-members-add-form')).toBeDefined();
  });

  // v0.117b F81: 멤버 add/delete pending 중에는 코스 단위 action (archive·restore·
  // transfer_owner·delete) 를 disabled 로 잠근다. Panel 의 onPendingChange 가
  // 부모 상태를 갱신 → 부모가 button.disabled 반영.
  it('scenario 11: F81 — disables archive/transfer_owner/delete while members panel is pending', async () => {
    mockTeachersAddState.isPending = true;
    mockUseClassroomList.mockReturnValue({
      data: {
        courses: [
          { id: 'c-101', name: '1학년 1반', courseState: 'ACTIVE', ownerId: 'owner@cam.hs.kr' },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderDetailPage('c-101');

    // panel onPendingChange 는 effect 로 흐르므로 다음 tick 을 기다린다.
    const { waitFor } = await import('@testing-library/react');
    await waitFor(() => {
      expect(
        (screen.getByTestId('classroom-detail-archive-btn') as HTMLButtonElement).disabled,
      ).toBe(true);
    });
    expect(
      (screen.getByTestId('classroom-detail-transfer-owner-btn') as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByTestId('classroom-detail-delete-btn') as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
