import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockMutateAsync = vi.fn();
let mockIsPending = false;
let mockError: Error | null = null;

vi.mock('../src/api/classroomPatch', () => ({
  useClassroomPatch: () => ({
    mutateAsync: mockMutateAsync,
    isPending: mockIsPending,
    error: mockError,
  }),
}));

import {
  ArchiveClassroomDialog,
  type ArchiveClassroomTarget,
} from '../src/routes/admin/ArchiveClassroomDialog';

describe('ArchiveClassroomDialog component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPending = false;
    mockError = null;
  });

  // 시나리오 1: currentState=ACTIVE -> 「아카이브」 버튼 · 클릭 시 patch 호출 (courseState: 'ARCHIVED')
  it('scenario 1: renders archive button when currentState is ACTIVE and calls patch with ARCHIVED', async () => {
    const onOpenChange = vi.fn();
    const onSuccess = vi.fn();
    const target: ArchiveClassroomTarget = {
      id: 'c-101',
      name: '1학년 수학',
      currentState: 'ACTIVE',
    };
    mockMutateAsync.mockResolvedValueOnce({
      course: { id: 'c-101', courseState: 'ARCHIVED' },
    });

    render(
      <ArchiveClassroomDialog
        open={true}
        onOpenChange={onOpenChange}
        target={target}
        onSuccess={onSuccess}
      />,
    );

    expect(screen.getByText('코스 아카이브 확인')).toBeDefined();
    expect(screen.getByText('c-101')).toBeDefined();
    expect(screen.getByText('1학년 수학')).toBeDefined();

    const submitBtn = screen.getByTestId('archive-classroom-submit');
    expect(submitBtn.textContent).toBe('아카이브');

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        id: 'c-101',
        courseState: 'ARCHIVED',
      });
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  // 시나리오 2: currentState=ARCHIVED -> 「복구」 버튼 · 클릭 시 patch 호출 (courseState: 'ACTIVE')
  it('scenario 2: renders restore button when currentState is ARCHIVED and calls patch with ACTIVE', async () => {
    const onOpenChange = vi.fn();
    const onSuccess = vi.fn();
    const target: ArchiveClassroomTarget = {
      id: 'c-102',
      name: '2학년 영어',
      currentState: 'ARCHIVED',
    };
    mockMutateAsync.mockResolvedValueOnce({
      course: { id: 'c-102', courseState: 'ACTIVE' },
    });

    render(
      <ArchiveClassroomDialog
        open={true}
        onOpenChange={onOpenChange}
        target={target}
        onSuccess={onSuccess}
      />,
    );

    expect(screen.getByText('코스 복구 확인')).toBeDefined();
    const submitBtn = screen.getByTestId('archive-classroom-submit');
    expect(submitBtn.textContent).toBe('복구');

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        id: 'c-102',
        courseState: 'ACTIVE',
      });
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  // 시나리오 3: mutation error -> error 배너 렌더
  it('scenario 3: renders error banner when mutation fails', () => {
    mockError = new Error('permission-denied: insufficient permissions');
    const target: ArchiveClassroomTarget = {
      id: 'c-101',
      name: '1학년 수학',
      currentState: 'ACTIVE',
    };

    render(
      <ArchiveClassroomDialog
        open={true}
        onOpenChange={vi.fn()}
        target={target}
      />,
    );

    const errorBanner = screen.getByTestId('archive-classroom-error');
    expect(errorBanner).toBeDefined();
    expect(errorBanner.textContent).toContain('아카이브 권한이 없거나 스코프가 부족합니다.');
  });

  // 시나리오 4: 성공 -> 다이얼로그 닫힘
  it('scenario 4: closes dialog on success', async () => {
    const onOpenChange = vi.fn();
    const target: ArchiveClassroomTarget = {
      id: 'c-101',
      name: '1학년 수학',
      currentState: 'ACTIVE',
    };
    mockMutateAsync.mockResolvedValueOnce({
      course: { id: 'c-101', courseState: 'ARCHIVED' },
    });

    render(
      <ArchiveClassroomDialog
        open={true}
        onOpenChange={onOpenChange}
        target={target}
      />,
    );

    fireEvent.click(screen.getByTestId('archive-classroom-submit'));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
