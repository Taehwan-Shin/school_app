import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockMutateAsync = vi.fn();
let mockIsPending = false;
let mockError: Error | null = null;
const mockReset = vi.fn();

vi.mock('../src/api/classroomCreate', () => ({
  useClassroomCreate: () => ({
    mutateAsync: mockMutateAsync,
    isPending: mockIsPending,
    error: mockError,
    reset: mockReset,
  }),
}));

import { CreateClassroomDialog } from '../src/routes/admin/CreateClassroomDialog';

describe('CreateClassroomDialog component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPending = false;
    mockError = null;
  });

  // 시나리오 1: open=false -> 미렌더
  it('scenario 1: does not render dialog content when open is false', () => {
    render(<CreateClassroomDialog open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByTestId('create-classroom-form')).toBeNull();
  });

  // 시나리오 2: name 빈 문자열 -> submit 버튼 disabled
  it('scenario 2: submit button is disabled when name is empty', () => {
    render(<CreateClassroomDialog open={true} onOpenChange={vi.fn()} />);
    const submitBtn = screen.getByTestId('create-classroom-submit') as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);

    const nameInput = screen.getByTestId('create-classroom-name');
    fireEvent.change(nameInput, { target: { value: '   ' } });
    expect(submitBtn.disabled).toBe(true);

    fireEvent.change(nameInput, { target: { value: '수학' } });
    expect(submitBtn.disabled).toBe(false);
  });

  // 시나리오 3: 정상 입력 후 submit -> callClassroomCreate 호출 (name · ownerId 기본값) · 성공 시 dialog close
  it('scenario 3: calls create mutation with name and default ownerId, then closes dialog on success', async () => {
    const onOpenChange = vi.fn();
    const onSuccess = vi.fn();
    mockMutateAsync.mockResolvedValueOnce({
      course: {
        id: 'new-course-1',
        name: '2026학년도 1학년 1반 수학',
        section: '1학기',
        ownerId: 'me',
        courseState: 'PROVISIONED',
      },
    });

    render(
      <CreateClassroomDialog
        open={true}
        onOpenChange={onOpenChange}
        onSuccess={onSuccess}
      />,
    );

    const nameInput = screen.getByTestId('create-classroom-name');
    const sectionInput = screen.getByTestId('create-classroom-section');
    fireEvent.change(nameInput, { target: { value: '2026학년도 1학년 1반 수학' } });
    fireEvent.change(sectionInput, { target: { value: '1학기' } });

    const submitBtn = screen.getByTestId('create-classroom-submit');
    expect(submitBtn.disabled).toBe(false);
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        name: '2026학년도 1학년 1반 수학',
        section: '1학기',
        description: undefined,
        room: undefined,
        ownerId: 'me',
        courseState: 'PROVISIONED',
      });
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'new-course-1' }),
      );
    });
  });

  // 시나리오 4: mutation error -> error 배너 렌더
  it('scenario 4: renders error banner when mutation fails', () => {
    mockError = new Error('permission-denied: insufficient permissions');
    render(<CreateClassroomDialog open={true} onOpenChange={vi.fn()} />);

    const errorBanner = screen.getByTestId('create-classroom-error');
    expect(errorBanner).toBeDefined();
    expect(errorBanner.textContent).toContain('코스 생성 권한이 없거나 스코프가 부족합니다.');
  });

  // v0.168: owner local-part 자동 부착 (v0.167 CreateGroupDialog 대칭).
  describe('v0.168: owner local-part 자동 부착', () => {
    it("owner 「me」 는 preview 없음 (특수 값)", () => {
      render(<CreateClassroomDialog open={true} onOpenChange={vi.fn()} />);
      const owner = screen.getByTestId('create-classroom-owner') as HTMLInputElement;
      expect(owner.value).toBe('me');
      expect(screen.queryByTestId('create-classroom-owner-preview')).toBeNull();
    });

    it("owner 로 local-part 입력 시 preview 노출", () => {
      render(<CreateClassroomDialog open={true} onOpenChange={vi.fn()} />);
      fireEvent.change(screen.getByTestId('create-classroom-owner'), {
        target: { value: 'teacher-b' },
      });
      expect(
        screen.getByTestId('create-classroom-owner-preview').textContent,
      ).toContain('teacher-b@cam.hs.kr');
    });

    it("owner 로 local-part + 실행 → 서버에 teacher-b@cam.hs.kr 로 전송", async () => {
      mockMutateAsync.mockResolvedValueOnce({
        course: { id: 'c1', name: 'x', section: 's', ownerId: 'teacher-b@cam.hs.kr', courseState: 'PROVISIONED' },
      });
      render(<CreateClassroomDialog open={true} onOpenChange={vi.fn()} />);
      fireEvent.change(screen.getByTestId('create-classroom-name'), {
        target: { value: '테스트 코스' },
      });
      fireEvent.change(screen.getByTestId('create-classroom-owner'), {
        target: { value: 'teacher-b' },
      });
      fireEvent.click(screen.getByTestId('create-classroom-submit'));

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ ownerId: 'teacher-b@cam.hs.kr' }),
        );
      });
    });

    it("owner 로 full email 도 뒤호환 (lower-case canonical)", async () => {
      mockMutateAsync.mockResolvedValueOnce({
        course: { id: 'c2', name: 'x', section: 's', ownerId: 'teacher-c@cam.hs.kr', courseState: 'PROVISIONED' },
      });
      render(<CreateClassroomDialog open={true} onOpenChange={vi.fn()} />);
      fireEvent.change(screen.getByTestId('create-classroom-name'), {
        target: { value: '테스트 코스' },
      });
      fireEvent.change(screen.getByTestId('create-classroom-owner'), {
        target: { value: 'TEACHER-C@cam.hs.kr' },
      });
      fireEvent.click(screen.getByTestId('create-classroom-submit'));

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ ownerId: 'teacher-c@cam.hs.kr' }),
        );
      });
    });

    it("owner 잘못된 도메인 → validation 에러 · mutation 미호출", () => {
      render(<CreateClassroomDialog open={true} onOpenChange={vi.fn()} />);
      fireEvent.change(screen.getByTestId('create-classroom-name'), {
        target: { value: '테스트' },
      });
      fireEvent.change(screen.getByTestId('create-classroom-owner'), {
        target: { value: 'teacher@other.com' },
      });
      fireEvent.click(screen.getByTestId('create-classroom-submit'));
      expect(mockMutateAsync).not.toHaveBeenCalled();
      expect(
        screen.getByTestId('create-classroom-owner-error').textContent,
      ).toContain('cam.hs.kr');
    });

    it("빈 owner → 자동으로 'me' fallback", async () => {
      mockMutateAsync.mockResolvedValueOnce({
        course: { id: 'c3', name: 'x', section: 's', ownerId: 'me', courseState: 'PROVISIONED' },
      });
      render(<CreateClassroomDialog open={true} onOpenChange={vi.fn()} />);
      fireEvent.change(screen.getByTestId('create-classroom-name'), {
        target: { value: '테스트' },
      });
      // owner 를 명시적으로 비움.
      fireEvent.change(screen.getByTestId('create-classroom-owner'), {
        target: { value: '   ' },
      });
      fireEvent.click(screen.getByTestId('create-classroom-submit'));
      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ ownerId: 'me' }),
        );
      });
    });
  });

  // v0.188: name/section/room 카운터 이식 + description counter v0.180 스타일 통일.
  describe('v0.188: name/section/room 카운터 + description 스타일 통일', () => {
    it('name 카운터: 초기 「0 / 750 자」 muted · 751자 red', () => {
      render(<CreateClassroomDialog open={true} onOpenChange={vi.fn()} />);
      const counter = screen.getByTestId('create-classroom-name-counter');
      expect(counter.textContent).toBe('0 / 750 자');
      expect(counter.className).toContain('text-fg-muted');
      fireEvent.change(screen.getByTestId('create-classroom-name'), {
        target: { value: 'x'.repeat(751) },
      });
      expect(counter.textContent).toBe('751 / 750 자');
      expect(counter.className).toContain('text-state-danger');
    });

    it('section 카운터: 초기 「0 / 2,800 자」 muted · 2801자 red', () => {
      render(<CreateClassroomDialog open={true} onOpenChange={vi.fn()} />);
      const counter = screen.getByTestId('create-classroom-section-counter');
      expect(counter.textContent).toBe('0 / 2,800 자');
      expect(counter.className).toContain('text-fg-muted');
      fireEvent.change(screen.getByTestId('create-classroom-section'), {
        target: { value: 'x'.repeat(2801) },
      });
      expect(counter.textContent).toBe('2,801 / 2,800 자');
      expect(counter.className).toContain('text-state-danger');
    });

    it('room 카운터: 초기 「0 / 650 자」 muted · 651자 red', () => {
      render(<CreateClassroomDialog open={true} onOpenChange={vi.fn()} />);
      const counter = screen.getByTestId('create-classroom-room-counter');
      expect(counter.textContent).toBe('0 / 650 자');
      expect(counter.className).toContain('text-fg-muted');
      fireEvent.change(screen.getByTestId('create-classroom-room'), {
        target: { value: 'x'.repeat(651) },
      });
      expect(counter.textContent).toBe('651 / 650 자');
      expect(counter.className).toContain('text-state-danger');
    });

    it('description 카운터: v0.180 스타일 통일 (text-small · text-state-danger · 「현재」 prefix 제거)', () => {
      render(<CreateClassroomDialog open={true} onOpenChange={vi.fn()} />);
      const counter = screen.getByTestId('create-classroom-description-counter');
      expect(counter.textContent).toBe('0 / 30,000 자'); // 「현재」 prefix 없음
      expect(counter.className).toContain('text-small');
      expect(counter.className).not.toContain('text-red-600'); // 옛 스타일 제거
      fireEvent.change(screen.getByTestId('create-classroom-description'), {
        target: { value: 'x'.repeat(30001) },
      });
      expect(counter.textContent).toBe('30,001 / 30,000 자');
      expect(counter.className).toContain('text-state-danger');
    });
  });

  // v0.192: owner local-part 64자 카운터 (v0.181/v0.191 대칭).
  describe('v0.192: owner local-part 카운터', () => {
    it('기본값 「me」 이면 카운터 미노출', () => {
      render(<CreateClassroomDialog open={true} onOpenChange={vi.fn()} />);
      expect(screen.queryByTestId('create-classroom-owner-local-counter')).toBeNull();
    });

    it('아이디 입력 시 카운터 노출 · 이내 muted · 초과 red', () => {
      render(<CreateClassroomDialog open={true} onOpenChange={vi.fn()} />);
      const input = screen.getByTestId('create-classroom-owner');
      fireEvent.change(input, { target: { value: 'teacher-a' } });
      const counter = screen.getByTestId('create-classroom-owner-local-counter');
      expect(counter.textContent).toContain('9 / 64');
      expect(counter.className).toContain('text-fg-muted');
      // 65자 초과
      fireEvent.change(input, { target: { value: 'a'.repeat(65) } });
      expect(counter.textContent).toContain('65 / 64');
      expect(counter.className).toContain('text-state-danger');
    });
  });
});
