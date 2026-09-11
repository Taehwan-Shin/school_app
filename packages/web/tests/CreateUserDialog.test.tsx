import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockMutateAsync = vi.fn();
const mockCallClassroomTeachersAdd = vi.fn();
const mockCallClassroomStudentsAdd = vi.fn();
let mockIsPending = false;
let mockError: Error | null = null;
let mockOrgunitsQuery: any = {
  data: { orgUnits: [] as any[] },
  isLoading: false,
  isError: false,
  error: null,
};
let mockClassroomListQuery: any = {
  data: { courses: [] as any[] },
  isLoading: false,
  isError: false,
  error: null,
};

vi.mock('../src/api/usersCreate.js', () => ({
  useCreateUser: () => ({
    mutateAsync: mockMutateAsync,
    isPending: mockIsPending,
    error: mockError,
  }),
}));

vi.mock('../src/api/orgunitsList.js', () => ({
  useOrgunitsList: () => mockOrgunitsQuery,
}));

vi.mock('../src/api/classroomList.js', () => ({
  useClassroomList: () => mockClassroomListQuery,
}));

vi.mock('../src/api/classroomTeachersAdd.js', () => ({
  callClassroomTeachersAdd: (data: unknown) => mockCallClassroomTeachersAdd(data),
}));

vi.mock('../src/api/classroomStudentsAdd.js', () => ({
  callClassroomStudentsAdd: (data: unknown) => mockCallClassroomStudentsAdd(data),
}));

import { CreateUserDialog } from '../src/routes/admin/CreateUserDialog.js';

describe('CreateUserDialog component', () => {
  beforeEach(() => {
    // v0.119b: vi.clearAllMocks 는 mockResolvedValueOnce 큐를 지우지 않음 →
    // 테스트 간 오염 방지를 위해 명시적 mockReset.
    mockMutateAsync.mockReset();
    mockCallClassroomTeachersAdd.mockReset();
    mockCallClassroomStudentsAdd.mockReset();
    vi.clearAllMocks();
    mockIsPending = false;
    mockError = null;
    mockOrgunitsQuery = {
      data: { orgUnits: [] },
      isLoading: false,
      isError: false,
      error: null,
    };
    mockClassroomListQuery = {
      data: { courses: [] },
      isLoading: false,
      isError: false,
      error: null,
    };
  });

  it('renders dialog fields when open', () => {
    render(<CreateUserDialog open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText('Google Workspace 계정 추가')).toBeDefined();
    expect(screen.getByLabelText(/이메일/)).toBeDefined();
    expect(screen.getByLabelText(/성/)).toBeDefined();
    expect(screen.getByLabelText(/이름/)).toBeDefined();
    expect(screen.getByLabelText(/비밀번호/)).toBeDefined();
    expect(screen.getByLabelText(/조직 단위/)).toBeDefined();
    expect(screen.getByTestId('create-user-submit')).toBeDefined();
    // v0.119: 클래스룸 role 라디오 + 리스트.
    expect(screen.getByTestId('create-user-classroom-role-student')).toBeDefined();
    expect(screen.getByTestId('create-user-classroom-role-teacher')).toBeDefined();
  });

  it('shows client validation error when domain is invalid', () => {
    render(<CreateUserDialog open={true} onOpenChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/이메일/), { target: { value: 'test@gmail.com' } });
    fireEvent.change(screen.getByLabelText(/성/), { target: { value: '홍' } });
    fireEvent.change(screen.getByLabelText(/이름/), { target: { value: '길동' } });
    fireEvent.change(screen.getByLabelText(/비밀번호/), { target: { value: 'pass12345' } });
    fireEvent.click(screen.getByTestId('create-user-submit'));
    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(screen.getByTestId('create-user-error')).toBeDefined();
    expect(screen.getByText('이메일은 @cam.hs.kr 도메인이어야 합니다.')).toBeDefined();
  });

  it('shows client validation error when password is too short', () => {
    render(<CreateUserDialog open={true} onOpenChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/이메일/), { target: { value: 'test@cam.hs.kr' } });
    fireEvent.change(screen.getByLabelText(/성/), { target: { value: '홍' } });
    fireEvent.change(screen.getByLabelText(/이름/), { target: { value: '길동' } });
    fireEvent.change(screen.getByLabelText(/비밀번호/), { target: { value: 'short' } });
    fireEvent.click(screen.getByTestId('create-user-submit'));
    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(screen.getByText('비밀번호는 최소 8자 이상이어야 합니다.')).toBeDefined();
  });

  it('submits valid form data and closes dialog on success (no classroom selected)', async () => {
    mockMutateAsync.mockResolvedValueOnce({ primaryEmail: 'new@cam.hs.kr', uid: 'u123' });
    const onOpenChange = vi.fn();

    render(<CreateUserDialog open={true} onOpenChange={onOpenChange} />);
    fireEvent.change(screen.getByLabelText(/이메일/), { target: { value: 'new@cam.hs.kr' } });
    fireEvent.change(screen.getByLabelText(/성/), { target: { value: '홍' } });
    fireEvent.change(screen.getByLabelText(/이름/), { target: { value: '길동' } });
    fireEvent.change(screen.getByLabelText(/비밀번호/), { target: { value: 'securePass123' } });
    fireEvent.change(screen.getByLabelText(/조직 단위/), { target: { value: '/학생/1학년' } });
    fireEvent.click(screen.getByTestId('create-user-submit'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        primaryEmail: 'new@cam.hs.kr',
        familyName: '홍',
        givenName: '길동',
        password: 'securePass123',
        orgUnitPath: '/학생/1학년',
        changePasswordAtNextLogin: true,
      });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    expect(mockCallClassroomTeachersAdd).not.toHaveBeenCalled();
    expect(mockCallClassroomStudentsAdd).not.toHaveBeenCalled();
  });

  it('displays server error message when mutation fails', () => {
    mockError = new Error('permission-denied');
    render(<CreateUserDialog open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByTestId('create-user-error')).toBeDefined();
    expect(screen.getByText('계정 생성 권한이 없거나 스코프가 부족합니다.')).toBeDefined();
  });

  // v0.119: OU datalist 렌더링.
  it('v0.119: OU 드롭다운은 useOrgunitsList 결과를 datalist option 으로 렌더', () => {
    mockOrgunitsQuery = {
      data: {
        orgUnits: [
          { orgUnitPath: '/학생/1학년', name: '1학년' },
          { orgUnitPath: '/교사', name: '교사' },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
    };
    render(<CreateUserDialog open={true} onOpenChange={vi.fn()} />);
    // Radix Dialog 는 portal 로 document.body 에 마운트 — testid 로 접근.
    const datalist = screen.getByTestId('create-user-orgunits-datalist');
    const options = datalist.querySelectorAll('option');
    expect(options).toHaveLength(2);
    expect(options[0].getAttribute('value')).toBe('/학생/1학년');
    expect(options[1].getAttribute('value')).toBe('/교사');
  });

  it('v0.119: OU 로드 실패 시 에러 안내 (직접 입력 가능)', () => {
    mockOrgunitsQuery = {
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('list_failed'),
    };
    render(<CreateUserDialog open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByTestId('create-user-orgunits-error')).toBeDefined();
    // OU 입력은 여전히 활성.
    expect(screen.getByTestId('create-user-orgunit-input')).toBeDefined();
  });

  // v0.119: 클래스룸 자동 배정 — 정상 경로.
  it('v0.119: 클래스룸 체크 후 계정 생성 → 선택된 각 클래스룸에 학생으로 추가 · dialog 닫힘', async () => {
    mockClassroomListQuery = {
      data: {
        courses: [
          { id: 'c-1', name: '1학년 1반 수학', courseState: 'ACTIVE' },
          { id: 'c-2', name: '1학년 2반 수학', courseState: 'ACTIVE' },
          { id: 'c-arch', name: '보관됨', courseState: 'ARCHIVED' },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
    };
    mockMutateAsync.mockResolvedValueOnce({ primaryEmail: 's@cam.hs.kr', uid: 'u1' });
    mockCallClassroomStudentsAdd.mockResolvedValue({ student: {} });
    const onOpenChange = vi.fn();

    render(<CreateUserDialog open={true} onOpenChange={onOpenChange} />);

    // ARCHIVED 는 렌더 안 되어야.
    expect(screen.queryByTestId('create-user-classroom-cb-c-arch')).toBeNull();

    fireEvent.change(screen.getByLabelText(/이메일/), { target: { value: 's@cam.hs.kr' } });
    fireEvent.change(screen.getByLabelText(/성/), { target: { value: '홍' } });
    fireEvent.change(screen.getByLabelText(/이름/), { target: { value: '길동' } });
    fireEvent.change(screen.getByLabelText(/비밀번호/), { target: { value: 'securePass123' } });
    fireEvent.click(screen.getByTestId('create-user-classroom-cb-c-1'));
    fireEvent.click(screen.getByTestId('create-user-classroom-cb-c-2'));
    fireEvent.click(screen.getByTestId('create-user-submit'));

    await waitFor(() => {
      expect(mockCallClassroomStudentsAdd).toHaveBeenCalledTimes(2);
    });
    expect(mockCallClassroomStudentsAdd).toHaveBeenNthCalledWith(1, {
      courseId: 'c-1',
      userId: 's@cam.hs.kr',
    });
    expect(mockCallClassroomStudentsAdd).toHaveBeenNthCalledWith(2, {
      courseId: 'c-2',
      userId: 's@cam.hs.kr',
    });
    expect(mockCallClassroomTeachersAdd).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('v0.119: 교사 역할 선택 시 teachers.add 로 라우팅', async () => {
    mockClassroomListQuery = {
      data: {
        courses: [{ id: 'c-1', name: 'A반', courseState: 'ACTIVE' }],
      },
      isLoading: false,
      isError: false,
      error: null,
    };
    mockMutateAsync.mockResolvedValueOnce({ primaryEmail: 't@cam.hs.kr', uid: 'u2' });
    mockCallClassroomTeachersAdd.mockResolvedValue({ teacher: {} });

    render(<CreateUserDialog open={true} onOpenChange={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/이메일/), { target: { value: 't@cam.hs.kr' } });
    fireEvent.change(screen.getByLabelText(/성/), { target: { value: '박' } });
    fireEvent.change(screen.getByLabelText(/이름/), { target: { value: '선생' } });
    fireEvent.change(screen.getByLabelText(/비밀번호/), { target: { value: 'securePass123' } });
    fireEvent.click(screen.getByTestId('create-user-classroom-role-teacher'));
    fireEvent.click(screen.getByTestId('create-user-classroom-cb-c-1'));
    fireEvent.click(screen.getByTestId('create-user-submit'));

    await waitFor(() => {
      expect(mockCallClassroomTeachersAdd).toHaveBeenCalledWith({
        courseId: 'c-1',
        userId: 't@cam.hs.kr',
      });
    });
    expect(mockCallClassroomStudentsAdd).not.toHaveBeenCalled();
  });

  // v0.119: 부분 실패 처리 — 계정 자체는 생성됐고 일부 클래스룸만 실패했다면
  // dialog 를 열어둔 채 결과를 표시.
  it('v0.119: 클래스룸 배정 부분 실패 → assign-results 배너 노출 · dialog 유지', async () => {
    mockClassroomListQuery = {
      data: {
        courses: [
          { id: 'c-1', name: 'A반', courseState: 'ACTIVE' },
          { id: 'c-2', name: 'B반', courseState: 'ACTIVE' },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
    };
    mockMutateAsync.mockResolvedValueOnce({ primaryEmail: 's@cam.hs.kr', uid: 'u1' });
    mockCallClassroomStudentsAdd
      .mockResolvedValueOnce({ student: {} })
      .mockRejectedValueOnce(new Error('permission_denied_for_B'));
    const onOpenChange = vi.fn();

    render(<CreateUserDialog open={true} onOpenChange={onOpenChange} />);
    fireEvent.change(screen.getByLabelText(/이메일/), { target: { value: 's@cam.hs.kr' } });
    fireEvent.change(screen.getByLabelText(/성/), { target: { value: '홍' } });
    fireEvent.change(screen.getByLabelText(/이름/), { target: { value: '길동' } });
    fireEvent.change(screen.getByLabelText(/비밀번호/), { target: { value: 'securePass123' } });
    fireEvent.click(screen.getByTestId('create-user-classroom-cb-c-1'));
    fireEvent.click(screen.getByTestId('create-user-classroom-cb-c-2'));
    fireEvent.click(screen.getByTestId('create-user-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('create-user-assign-results')).toBeDefined();
    });
    const banner = screen.getByTestId('create-user-assign-results');
    expect(banner.textContent).toContain('A반');
    expect(banner.textContent).toContain('B반');
    expect(banner.textContent).toContain('permission_denied_for_B');
    // dialog 는 닫히지 않음.
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  // v0.119b F91: OU 안내 문구가 「기존 OU 만」임을 명시. 잘못된 「자동 생성」
  // 오해를 방지.
  it('v0.119b F91: OU 안내는 「기존 OU 만」을 명시', () => {
    render(<CreateUserDialog open={true} onOpenChange={vi.fn()} />);
    // 헬프 문구.
    expect(
      screen.getByText(/기존에 있는 조직 단위 경로만 사용할 수 있습니다/),
    ).toBeDefined();
  });

  // v0.119b F94: dialog 가 닫힘 상태면 classroom / orgunits 훅에 `open=false` 를
  // 넘겨 fetch 를 억제. mocked 훅이 argument 를 무시하고 상수 반환하므로 여기서는
  // hook 호출 인자를 spy 로 검증한다.
  it('v0.119b F94: open=false 이면 useClassroomList/useOrgunitsList 에 enabled=false 로 호출', async () => {
    // 새 spy 모듈 mock 을 설정하려면 모듈이 이미 import 됐으므로 어렵다.
    // 대신 소스 계약 (`useClassroomList(open)`, `useOrgunitsList(open)`) 을
    // 소스 문자열로 검증.
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync(
        require.resolve('../src/routes/admin/CreateUserDialog.tsx'),
        'utf8',
      ),
    );
    expect(src).toContain('useClassroomList(open)');
    expect(src).toContain('useOrgunitsList(open)');
  });

  // v0.119b F92: busy 중 form 요소 disabled. race condition 방지.
  it('v0.119b F92: mutation pending 중 form 요소들이 disabled', () => {
    mockClassroomListQuery = {
      data: { courses: [{ id: 'c-1', name: 'A반', courseState: 'ACTIVE' }] },
      isLoading: false,
      isError: false,
      error: null,
    };
    mockIsPending = true;
    render(<CreateUserDialog open={true} onOpenChange={vi.fn()} />);
    expect((screen.getByLabelText(/이메일/) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText(/성/) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText(/이름/) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText(/비밀번호/) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByTestId('create-user-orgunit-input') as HTMLInputElement).disabled).toBe(
      true,
    );
    expect(
      (screen.getByTestId('create-user-classroom-role-student') as HTMLInputElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByTestId('create-user-classroom-role-teacher') as HTMLInputElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByTestId('create-user-classroom-cb-c-1') as HTMLInputElement).disabled,
    ).toBe(true);
  });

  // v0.119b F93: 계정 생성 성공 후 비밀번호 state 를 지운다 (assign 결과 배너로
  // dialog 가 유지되는 경우에도 password 가 남지 않도록).
  it('v0.119b F93: 계정 생성 성공 후 password 필드가 빔 (부분 실패 배너 유지 케이스)', async () => {
    mockClassroomListQuery = {
      data: {
        courses: [{ id: 'c-1', name: 'A반', courseState: 'ACTIVE' }],
      },
      isLoading: false,
      isError: false,
      error: null,
    };
    mockMutateAsync.mockResolvedValueOnce({ primaryEmail: 's@cam.hs.kr', uid: 'u' });
    mockCallClassroomStudentsAdd.mockRejectedValue(new Error('deliberate_fail'));
    render(<CreateUserDialog open={true} onOpenChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/이메일/), { target: { value: 's@cam.hs.kr' } });
    fireEvent.change(screen.getByLabelText(/성/), { target: { value: '홍' } });
    fireEvent.change(screen.getByLabelText(/이름/), { target: { value: '길동' } });
    fireEvent.change(screen.getByLabelText(/비밀번호/), { target: { value: 'securePass123' } });
    fireEvent.click(screen.getByTestId('create-user-classroom-cb-c-1'));
    fireEvent.click(screen.getByTestId('create-user-submit'));
    await waitFor(() => {
      expect(screen.getByTestId('create-user-assign-results')).toBeDefined();
    });
    // 배너가 뜬 상태에서도 password 입력값은 비어야.
    const pw = screen.getByLabelText(/비밀번호/) as HTMLInputElement;
    expect(pw.value).toBe('');
  });

  it('v0.119: usersCreate 실패 시 classroom add 는 시도 안 함', async () => {
    mockClassroomListQuery = {
      data: {
        courses: [{ id: 'c-1', name: 'A반', courseState: 'ACTIVE' }],
      },
      isLoading: false,
      isError: false,
      error: null,
    };
    mockMutateAsync.mockRejectedValueOnce(new Error('permission-denied'));
    mockError = new Error('permission-denied');

    render(<CreateUserDialog open={true} onOpenChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/이메일/), { target: { value: 's@cam.hs.kr' } });
    fireEvent.change(screen.getByLabelText(/성/), { target: { value: '홍' } });
    fireEvent.change(screen.getByLabelText(/이름/), { target: { value: '길동' } });
    fireEvent.change(screen.getByLabelText(/비밀번호/), { target: { value: 'securePass123' } });
    fireEvent.click(screen.getByTestId('create-user-classroom-cb-c-1'));
    fireEvent.click(screen.getByTestId('create-user-submit'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalled();
    });
    // 짧게 기다린 뒤 classroom API 호출 없어야.
    expect(mockCallClassroomStudentsAdd).not.toHaveBeenCalled();
    expect(mockCallClassroomTeachersAdd).not.toHaveBeenCalled();
  });
});
