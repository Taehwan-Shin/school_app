import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockCallClassroomPatch = vi.fn();

vi.mock('../src/api/classroomPatch.js', () => ({
  callClassroomPatch: (data: unknown) => mockCallClassroomPatch(data),
}));

import { BulkRenameClassroomDialog } from '../src/routes/admin/BulkRenameClassroomDialog.js';

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('BulkRenameClassroomDialog component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('초기 상태: newName == originalName → confirm 버튼 disabled', () => {
    const courses = [
      { id: 'a', name: '수학' },
      { id: 'b', name: '과학' },
    ];
    renderWithClient(
      <BulkRenameClassroomDialog
        open={true}
        onOpenChange={vi.fn()}
        courses={courses}
      />,
    );
    const btn = screen.getByTestId('bulk-rename-classroom-confirm-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toContain('0');
  });

  it('개별 편집 → 변경 대상 카운트 · confirm 버튼 활성화', () => {
    const courses = [
      { id: 'a', name: '수학' },
      { id: 'b', name: '과학' },
    ];
    renderWithClient(
      <BulkRenameClassroomDialog
        open={true}
        onOpenChange={vi.fn()}
        courses={courses}
      />,
    );
    fireEvent.change(screen.getByTestId('bulk-rename-classroom-row-input-a'), {
      target: { value: '수학 심화' },
    });
    const btn = screen.getByTestId('bulk-rename-classroom-confirm-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toContain('1');
  });

  it('패턴 적용 → 모든 행에 find/replace 결과 반영', () => {
    const courses = [
      { id: 'a', name: '2025 1학년 1반' },
      { id: 'b', name: '2025 2학년 3반' },
      { id: 'c', name: '기타' },
    ];
    renderWithClient(
      <BulkRenameClassroomDialog
        open={true}
        onOpenChange={vi.fn()}
        courses={courses}
      />,
    );
    fireEvent.change(screen.getByTestId('bulk-rename-classroom-find-input'), {
      target: { value: '2025' },
    });
    fireEvent.change(screen.getByTestId('bulk-rename-classroom-replace-input'), {
      target: { value: '2026' },
    });
    fireEvent.click(screen.getByTestId('bulk-rename-classroom-apply-pattern-btn'));

    expect(
      (screen.getByTestId('bulk-rename-classroom-row-input-a') as HTMLInputElement).value,
    ).toBe('2026 1학년 1반');
    expect(
      (screen.getByTestId('bulk-rename-classroom-row-input-b') as HTMLInputElement).value,
    ).toBe('2026 2학년 3반');
    expect(
      (screen.getByTestId('bulk-rename-classroom-row-input-c') as HTMLInputElement).value,
    ).toBe('기타'); // 매칭 없음 → 그대로.
    // 변경 대상 2개.
    const btn = screen.getByTestId('bulk-rename-classroom-confirm-btn') as HTMLButtonElement;
    expect(btn.textContent).toContain('2');
  });

  it('변경 대상만 순차 patch (name 필드로) — 무변경 행은 호출 안 함', async () => {
    const courses = [
      { id: 'a', name: '수학' },
      { id: 'b', name: '과학' },
      { id: 'c', name: '영어' },
    ];
    mockCallClassroomPatch.mockResolvedValue({ course: { id: 'x' } });
    renderWithClient(
      <BulkRenameClassroomDialog
        open={true}
        onOpenChange={vi.fn()}
        courses={courses}
      />,
    );
    fireEvent.change(screen.getByTestId('bulk-rename-classroom-row-input-a'), {
      target: { value: '수학 심화' },
    });
    fireEvent.change(screen.getByTestId('bulk-rename-classroom-row-input-c'), {
      target: { value: '영어 회화' },
    });
    fireEvent.click(screen.getByTestId('bulk-rename-classroom-confirm-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('bulk-rename-classroom-done')).toBeDefined();
    });
    expect(mockCallClassroomPatch).toHaveBeenCalledTimes(2);
    expect(mockCallClassroomPatch).toHaveBeenNthCalledWith(1, {
      id: 'a',
      name: '수학 심화',
    });
    expect(mockCallClassroomPatch).toHaveBeenNthCalledWith(2, {
      id: 'c',
      name: '영어 회화',
    });
  });

  it('trim 처리 — 앞뒤 공백은 서버 요청 · 판정 모두에서 제거', async () => {
    const courses = [{ id: 'a', name: '수학' }];
    mockCallClassroomPatch.mockResolvedValue({ course: { id: 'a' } });
    renderWithClient(
      <BulkRenameClassroomDialog
        open={true}
        onOpenChange={vi.fn()}
        courses={courses}
      />,
    );
    // trim 후 같으면 변경 대상 아님.
    fireEvent.change(screen.getByTestId('bulk-rename-classroom-row-input-a'), {
      target: { value: '  수학  ' },
    });
    const btn = screen.getByTestId('bulk-rename-classroom-confirm-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);

    // trim 후 다르면 변경 대상 · patch 요청은 trim 된 값으로.
    fireEvent.change(screen.getByTestId('bulk-rename-classroom-row-input-a'), {
      target: { value: '  수학 II  ' },
    });
    fireEvent.click(screen.getByTestId('bulk-rename-classroom-confirm-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('bulk-rename-classroom-done')).toBeDefined();
    });
    expect(mockCallClassroomPatch).toHaveBeenCalledWith({
      id: 'a',
      name: '수학 II',
    });
  });

  it('빈 이름 입력 → 무효 · confirm 버튼 disabled', () => {
    const courses = [{ id: 'a', name: '수학' }];
    renderWithClient(
      <BulkRenameClassroomDialog
        open={true}
        onOpenChange={vi.fn()}
        courses={courses}
      />,
    );
    fireEvent.change(screen.getByTestId('bulk-rename-classroom-row-input-a'), {
      target: { value: '  ' },
    });
    const btn = screen.getByTestId('bulk-rename-classroom-confirm-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(screen.getByTestId('bulk-rename-classroom-summary').textContent).toContain('빈 이름');
  });

  it('일부 실패 시 done 에 failures 목록 표시', async () => {
    const courses = [
      { id: 'a', name: '수학' },
      { id: 'b', name: '과학' },
    ];
    mockCallClassroomPatch
      .mockResolvedValueOnce({ course: { id: 'a' } })
      .mockRejectedValueOnce(new Error('boom for b'));
    renderWithClient(
      <BulkRenameClassroomDialog
        open={true}
        onOpenChange={vi.fn()}
        courses={courses}
      />,
    );
    fireEvent.change(screen.getByTestId('bulk-rename-classroom-row-input-a'), {
      target: { value: '수학 심화' },
    });
    fireEvent.change(screen.getByTestId('bulk-rename-classroom-row-input-b'), {
      target: { value: '과학 실험' },
    });
    fireEvent.click(screen.getByTestId('bulk-rename-classroom-confirm-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('bulk-rename-classroom-done')).toBeDefined();
    });
    const failures = screen.getByTestId('bulk-rename-classroom-failures');
    expect(failures.textContent).toContain('b');
    expect(failures.textContent).toContain('boom for b');
  });

  it('원래대로 버튼 → find/replace 및 모든 row 초기화', () => {
    const courses = [
      { id: 'a', name: '수학' },
      { id: 'b', name: '과학' },
    ];
    renderWithClient(
      <BulkRenameClassroomDialog
        open={true}
        onOpenChange={vi.fn()}
        courses={courses}
      />,
    );
    fireEvent.change(screen.getByTestId('bulk-rename-classroom-row-input-a'), {
      target: { value: '수학 심화' },
    });
    fireEvent.change(screen.getByTestId('bulk-rename-classroom-find-input'), {
      target: { value: '수학' },
    });
    fireEvent.click(screen.getByTestId('bulk-rename-classroom-reset-btn'));
    expect(
      (screen.getByTestId('bulk-rename-classroom-row-input-a') as HTMLInputElement).value,
    ).toBe('수학');
    expect(
      (screen.getByTestId('bulk-rename-classroom-find-input') as HTMLInputElement).value,
    ).toBe('');
  });

  it('F99 대칭: confirm 시 대상을 snapshot 으로 고정 (완료 후 courses=[] 로 rerender 되어도 성공 수 유지)', async () => {
    const initialCourses = [
      { id: 'a', name: '수학' },
      { id: 'b', name: '과학' },
    ];
    mockCallClassroomPatch.mockResolvedValue({ course: { id: 'x' } });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <BulkRenameClassroomDialog
            open={true}
            onOpenChange={vi.fn()}
            courses={initialCourses}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.change(screen.getByTestId('bulk-rename-classroom-row-input-a'), {
      target: { value: '수학 심화' },
    });
    fireEvent.change(screen.getByTestId('bulk-rename-classroom-row-input-b'), {
      target: { value: '과학 실험' },
    });
    fireEvent.click(screen.getByTestId('bulk-rename-classroom-confirm-btn'));

    // list invalidation 시뮬레이션: 부모가 courses=[] 로 rerender.
    rerender(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <BulkRenameClassroomDialog
            open={true}
            onOpenChange={vi.fn()}
            courses={[]}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('bulk-rename-classroom-done')).toBeDefined();
    });
    const done = screen.getByTestId('bulk-rename-classroom-done');
    expect(done.textContent).toContain('2');
    expect(done.textContent).toContain('성공');
    expect(mockCallClassroomPatch).toHaveBeenCalledTimes(2);
  });

  it('F100 대칭: 모든 input 에 label htmlFor/id 연결', () => {
    const courses = [{ id: 'a', name: '수학' }];
    renderWithClient(
      <BulkRenameClassroomDialog
        open={true}
        onOpenChange={vi.fn()}
        courses={courses}
      />,
    );
    // Dialog 는 portal 로 document.body 에 렌더되므로 container 대신 document 를 검색.
    // find/replace input.
    expect(document.querySelector('label[for="bulk-rename-classroom-find-input"]')).toBeTruthy();
    expect(document.querySelector('#bulk-rename-classroom-find-input')).toBeTruthy();
    expect(document.querySelector('label[for="bulk-rename-classroom-replace-input"]')).toBeTruthy();
    expect(document.querySelector('#bulk-rename-classroom-replace-input')).toBeTruthy();
    // per-row input.
    expect(document.querySelector('label[for="bulk-rename-classroom-row-input-a"]')).toBeTruthy();
    expect(document.querySelector('#bulk-rename-classroom-row-input-a')).toBeTruthy();
  });

  it('open false → true 재열기 시 rows 재계산 (open 초기화)', () => {
    const courses = [{ id: 'a', name: '수학' }];
    const { rerender } = renderWithClient(
      <BulkRenameClassroomDialog
        open={true}
        onOpenChange={vi.fn()}
        courses={courses}
      />,
    );
    fireEvent.change(screen.getByTestId('bulk-rename-classroom-row-input-a'), {
      target: { value: '수학 심화' },
    });
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <BulkRenameClassroomDialog
            open={false}
            onOpenChange={vi.fn()}
            courses={courses}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <BulkRenameClassroomDialog
            open={true}
            onOpenChange={vi.fn()}
            courses={courses}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(
      (screen.getByTestId('bulk-rename-classroom-row-input-a') as HTMLInputElement).value,
    ).toBe('수학');
  });

  it('취소 버튼 → onOpenChange(false) 호출', () => {
    const courses = [{ id: 'a', name: '수학' }];
    const onOpenChange = vi.fn();
    renderWithClient(
      <BulkRenameClassroomDialog
        open={true}
        onOpenChange={onOpenChange}
        courses={courses}
      />,
    );
    fireEvent.click(screen.getByTestId('bulk-rename-classroom-cancel-btn'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
