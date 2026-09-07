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
});
