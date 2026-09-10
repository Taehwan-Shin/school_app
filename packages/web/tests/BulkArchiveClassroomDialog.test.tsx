import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockCallClassroomPatch = vi.fn();

vi.mock('../src/api/classroomPatch.js', () => ({
  callClassroomPatch: (data: unknown) => mockCallClassroomPatch(data),
}));

import { BulkArchiveClassroomDialog } from '../src/routes/admin/BulkArchiveClassroomDialog.js';

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('BulkArchiveClassroomDialog component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('confirm 버튼은 대상 개수 입력 전엔 disabled', () => {
    const courses = [
      { id: 'a', name: '수학' },
      { id: 'b', name: '과학' },
    ];
    renderWithClient(
      <BulkArchiveClassroomDialog
        open={true}
        onOpenChange={vi.fn()}
        courses={courses}
        direction="archive"
      />,
    );
    const btn = screen.getByTestId('bulk-archive-classroom-confirm-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.change(screen.getByTestId('bulk-archive-classroom-confirm-input'), {
      target: { value: '2' },
    });
    expect(btn.disabled).toBe(false);
  });

  it('archive 방향 → callClassroomPatch 를 courseState=ARCHIVED 로 순차 호출', async () => {
    const courses = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ];
    mockCallClassroomPatch.mockResolvedValue({ course: { id: 'x' } });
    renderWithClient(
      <BulkArchiveClassroomDialog
        open={true}
        onOpenChange={vi.fn()}
        courses={courses}
        direction="archive"
      />,
    );
    fireEvent.change(screen.getByTestId('bulk-archive-classroom-confirm-input'), {
      target: { value: '2' },
    });
    fireEvent.click(screen.getByTestId('bulk-archive-classroom-confirm-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('bulk-archive-classroom-done')).toBeDefined();
    });
    expect(mockCallClassroomPatch).toHaveBeenCalledTimes(2);
    expect(mockCallClassroomPatch).toHaveBeenNthCalledWith(1, {
      id: 'a',
      courseState: 'ARCHIVED',
    });
    expect(mockCallClassroomPatch).toHaveBeenNthCalledWith(2, {
      id: 'b',
      courseState: 'ARCHIVED',
    });
  });

  it('restore 방향 → callClassroomPatch 를 courseState=ACTIVE 로 호출', async () => {
    const courses = [{ id: 'a', name: 'A' }];
    mockCallClassroomPatch.mockResolvedValue({ course: { id: 'a' } });
    renderWithClient(
      <BulkArchiveClassroomDialog
        open={true}
        onOpenChange={vi.fn()}
        courses={courses}
        direction="restore"
      />,
    );
    fireEvent.change(screen.getByTestId('bulk-archive-classroom-confirm-input'), {
      target: { value: '1' },
    });
    fireEvent.click(screen.getByTestId('bulk-archive-classroom-confirm-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('bulk-archive-classroom-done')).toBeDefined();
    });
    expect(mockCallClassroomPatch).toHaveBeenCalledWith({
      id: 'a',
      courseState: 'ACTIVE',
    });
  });

  it('일부 실패 시 done 상태에 failures 리스트 표시', async () => {
    const courses = [
      { id: 'a' },
      { id: 'b' },
    ];
    mockCallClassroomPatch
      .mockResolvedValueOnce({ course: { id: 'a' } })
      .mockRejectedValueOnce(new Error('boom for b'));
    renderWithClient(
      <BulkArchiveClassroomDialog
        open={true}
        onOpenChange={vi.fn()}
        courses={courses}
        direction="archive"
      />,
    );
    fireEvent.change(screen.getByTestId('bulk-archive-classroom-confirm-input'), {
      target: { value: '2' },
    });
    fireEvent.click(screen.getByTestId('bulk-archive-classroom-confirm-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('bulk-archive-classroom-done')).toBeDefined();
    });
    const failures = screen.getByTestId('bulk-archive-classroom-failures');
    expect(failures.textContent).toContain('b');
    expect(failures.textContent).toContain('boom for b');
  });

  it('label 은 「아카이브」 또는 「복구」 direction 별로', () => {
    const courses = [{ id: 'a' }];
    const { rerender } = renderWithClient(
      <BulkArchiveClassroomDialog
        open={true}
        onOpenChange={vi.fn()}
        courses={courses}
        direction="archive"
      />,
    );
    expect(
      screen.getByTestId('bulk-archive-classroom-confirm-btn').textContent,
    ).toContain('아카이브');
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <BulkArchiveClassroomDialog
            open={true}
            onOpenChange={vi.fn()}
            courses={courses}
            direction="restore"
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(
      screen.getByTestId('bulk-archive-classroom-confirm-btn').textContent,
    ).toContain('복구');
  });

  it('취소 버튼 → onOpenChange(false) 호출', () => {
    const courses = [{ id: 'a' }];
    const onOpenChange = vi.fn();
    renderWithClient(
      <BulkArchiveClassroomDialog
        open={true}
        onOpenChange={onOpenChange}
        courses={courses}
        direction="archive"
      />,
    );
    fireEvent.click(screen.getByTestId('bulk-archive-classroom-cancel-btn'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // v0.115b F73: confirm 시점에 courses·direction 을 snapshot 으로 고정.
  // 완료 후 부모의 list invalidation 으로 courses 가 빈 배열로 재계산돼도
  // done 화면의 성공 수·총 대상 수는 원본 값을 유지해야 한다.
  it('F73: confirm 시 대상을 snapshot 으로 고정 (완료 후 courses=[] 로 바뀌어도 성공 수 유지)', async () => {
    const initialCourses = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ];
    mockCallClassroomPatch.mockResolvedValue({ course: { id: 'x' } });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <BulkArchiveClassroomDialog
            open={true}
            onOpenChange={vi.fn()}
            courses={initialCourses}
            direction="archive"
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.change(screen.getByTestId('bulk-archive-classroom-confirm-input'), {
      target: { value: '2' },
    });
    fireEvent.click(screen.getByTestId('bulk-archive-classroom-confirm-btn'));

    // list invalidation 시뮬레이션: 부모가 courses=[] 로 rerender.
    rerender(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <BulkArchiveClassroomDialog
            open={true}
            onOpenChange={vi.fn()}
            courses={[]}
            direction="archive"
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('bulk-archive-classroom-done')).toBeDefined();
    });
    // snapshot 원본 (2건) 기준으로 성공 수가 표시돼야 한다.
    const done = screen.getByTestId('bulk-archive-classroom-done');
    expect(done.textContent).toContain('2');
    expect(done.textContent).toContain('성공');
    // patch 는 snapshot 상 2건 순차 호출 (부모 rerender 전에 실행 시작).
    expect(mockCallClassroomPatch).toHaveBeenCalledTimes(2);
  });

  it('open toggle 상태 초기화 (open false → true 시 confirm 필드 비었음)', () => {
    const courses = [{ id: 'a' }];
    const { rerender } = renderWithClient(
      <BulkArchiveClassroomDialog
        open={true}
        onOpenChange={vi.fn()}
        courses={courses}
        direction="archive"
      />,
    );
    fireEvent.change(screen.getByTestId('bulk-archive-classroom-confirm-input'), {
      target: { value: '1' },
    });
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <BulkArchiveClassroomDialog
            open={false}
            onOpenChange={vi.fn()}
            courses={courses}
            direction="archive"
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <BulkArchiveClassroomDialog
            open={true}
            onOpenChange={vi.fn()}
            courses={courses}
            direction="archive"
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(
      (screen.getByTestId('bulk-archive-classroom-confirm-input') as HTMLInputElement).value,
    ).toBe('');
  });
});
