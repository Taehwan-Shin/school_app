import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockCallClassroomPatch = vi.fn();

vi.mock('../src/api/classroomPatch.js', () => ({
  callClassroomPatch: (data: unknown) => mockCallClassroomPatch(data),
}));

import { RenameClassroomDialog } from '../src/routes/admin/RenameClassroomDialog.js';

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('RenameClassroomDialog component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('초기 상태: 값 미변경 → 저장 버튼 disabled', () => {
    renderWithClient(
      <RenameClassroomDialog
        open={true}
        onOpenChange={vi.fn()}
        target={{ id: 'c1', name: '수학', section: '1학기' }}
      />,
    );
    const btn = screen.getByTestId('rename-classroom-confirm-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('이름 변경 → 저장 버튼 활성 · patch 요청은 name 만 포함', async () => {
    mockCallClassroomPatch.mockResolvedValueOnce({ course: { id: 'c1' } });
    renderWithClient(
      <RenameClassroomDialog
        open={true}
        onOpenChange={vi.fn()}
        target={{ id: 'c1', name: '수학', section: '1학기' }}
      />,
    );
    fireEvent.change(screen.getByTestId('rename-classroom-name-input'), {
      target: { value: '수학 심화' },
    });
    const btn = screen.getByTestId('rename-classroom-confirm-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByTestId('rename-classroom-done')).toBeDefined();
    });
    expect(mockCallClassroomPatch).toHaveBeenCalledWith({
      id: 'c1',
      name: '수학 심화',
    });
  });

  it('섹션만 변경 → patch 요청은 section 만 포함', async () => {
    mockCallClassroomPatch.mockResolvedValueOnce({ course: { id: 'c1' } });
    renderWithClient(
      <RenameClassroomDialog
        open={true}
        onOpenChange={vi.fn()}
        target={{ id: 'c1', name: '수학', section: '1학기' }}
      />,
    );
    fireEvent.change(screen.getByTestId('rename-classroom-section-input'), {
      target: { value: '2학기' },
    });
    fireEvent.click(screen.getByTestId('rename-classroom-confirm-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('rename-classroom-done')).toBeDefined();
    });
    expect(mockCallClassroomPatch).toHaveBeenCalledWith({
      id: 'c1',
      section: '2학기',
    });
  });

  it('name + section 동시 변경 → patch 요청은 두 필드 포함', async () => {
    mockCallClassroomPatch.mockResolvedValueOnce({ course: { id: 'c1' } });
    renderWithClient(
      <RenameClassroomDialog
        open={true}
        onOpenChange={vi.fn()}
        target={{ id: 'c1', name: '수학', section: '1학기' }}
      />,
    );
    fireEvent.change(screen.getByTestId('rename-classroom-name-input'), {
      target: { value: '수학 심화' },
    });
    fireEvent.change(screen.getByTestId('rename-classroom-section-input'), {
      target: { value: '2학기' },
    });
    fireEvent.click(screen.getByTestId('rename-classroom-confirm-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('rename-classroom-done')).toBeDefined();
    });
    expect(mockCallClassroomPatch).toHaveBeenCalledWith({
      id: 'c1',
      name: '수학 심화',
      section: '2학기',
    });
  });

  it('trim 처리 — 앞뒤 공백은 서버 요청 · 변경 판정 모두에서 제거', async () => {
    mockCallClassroomPatch.mockResolvedValueOnce({ course: { id: 'c1' } });
    renderWithClient(
      <RenameClassroomDialog
        open={true}
        onOpenChange={vi.fn()}
        target={{ id: 'c1', name: '수학', section: '1학기' }}
      />,
    );
    // trim 후 같으면 변경 아님.
    fireEvent.change(screen.getByTestId('rename-classroom-name-input'), {
      target: { value: '  수학  ' },
    });
    const btn = screen.getByTestId('rename-classroom-confirm-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    // trim 후 다르면 변경 · trim 된 값으로 patch.
    fireEvent.change(screen.getByTestId('rename-classroom-name-input'), {
      target: { value: '  수학 심화  ' },
    });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByTestId('rename-classroom-done')).toBeDefined();
    });
    expect(mockCallClassroomPatch).toHaveBeenCalledWith({
      id: 'c1',
      name: '수학 심화',
    });
  });

  it('빈 이름 → aria-invalid + 안내 · 저장 disabled', () => {
    renderWithClient(
      <RenameClassroomDialog
        open={true}
        onOpenChange={vi.fn()}
        target={{ id: 'c1', name: '수학' }}
      />,
    );
    const input = screen.getByTestId('rename-classroom-name-input');
    fireEvent.change(input, { target: { value: '  ' } });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByTestId('rename-classroom-name-empty')).toBeDefined();
    const btn = screen.getByTestId('rename-classroom-confirm-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('이름 750자 초과 → aria-invalid + 안내 · 저장 disabled', () => {
    renderWithClient(
      <RenameClassroomDialog
        open={true}
        onOpenChange={vi.fn()}
        target={{ id: 'c1', name: '수학' }}
      />,
    );
    const input = screen.getByTestId('rename-classroom-name-input');
    fireEvent.change(input, { target: { value: 'a'.repeat(751) } });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByTestId('rename-classroom-name-too-long')).toBeDefined();
    expect((screen.getByTestId('rename-classroom-confirm-btn') as HTMLButtonElement).disabled).toBe(true);
    // 750 정확 통과.
    fireEvent.change(input, { target: { value: 'a'.repeat(750) } });
    expect(input.getAttribute('aria-invalid')).toBeNull();
    expect(screen.queryByTestId('rename-classroom-name-too-long')).toBeNull();
    expect((screen.getByTestId('rename-classroom-confirm-btn') as HTMLButtonElement).disabled).toBe(false);
  });

  it('섹션 2800자 초과 → aria-invalid + 안내 · 저장 disabled', () => {
    renderWithClient(
      <RenameClassroomDialog
        open={true}
        onOpenChange={vi.fn()}
        target={{ id: 'c1', name: '수학' }}
      />,
    );
    const input = screen.getByTestId('rename-classroom-section-input');
    fireEvent.change(input, { target: { value: 'a'.repeat(2801) } });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByTestId('rename-classroom-section-too-long')).toBeDefined();
    expect((screen.getByTestId('rename-classroom-confirm-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  it('빈 섹션으로 변경 → patch 요청에 section="" 포함 (clear 시나리오)', async () => {
    mockCallClassroomPatch.mockResolvedValueOnce({ course: { id: 'c1' } });
    renderWithClient(
      <RenameClassroomDialog
        open={true}
        onOpenChange={vi.fn()}
        target={{ id: 'c1', name: '수학', section: '1학기' }}
      />,
    );
    fireEvent.change(screen.getByTestId('rename-classroom-section-input'), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByTestId('rename-classroom-confirm-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('rename-classroom-done')).toBeDefined();
    });
    expect(mockCallClassroomPatch).toHaveBeenCalledWith({
      id: 'c1',
      section: '',
    });
  });

  it('실패 시 error 메시지 표시 · edit phase 유지', async () => {
    mockCallClassroomPatch.mockRejectedValueOnce(new Error('boom'));
    renderWithClient(
      <RenameClassroomDialog
        open={true}
        onOpenChange={vi.fn()}
        target={{ id: 'c1', name: '수학' }}
      />,
    );
    fireEvent.change(screen.getByTestId('rename-classroom-name-input'), {
      target: { value: '수학 심화' },
    });
    fireEvent.click(screen.getByTestId('rename-classroom-confirm-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('rename-classroom-error')).toBeDefined();
    });
    expect(screen.getByTestId('rename-classroom-error').textContent).toContain('boom');
    // done 이 아니라 edit phase 유지.
    expect(screen.queryByTestId('rename-classroom-done')).toBeNull();
  });

  it('F99 대칭: 열린 상태에서 target prop 이 재계산돼도 편집 상태 유지', async () => {
    mockCallClassroomPatch.mockResolvedValue({ course: { id: 'c1' } });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <RenameClassroomDialog
            open={true}
            onOpenChange={vi.fn()}
            target={{ id: 'c1', name: '수학' }}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.change(screen.getByTestId('rename-classroom-name-input'), {
      target: { value: '수학 심화' },
    });
    // 부모 list invalidation 시뮬레이션 — target 이 다른 값으로 재계산.
    rerender(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <RenameClassroomDialog
            open={true}
            onOpenChange={vi.fn()}
            target={{ id: 'c1', name: '리셋된 이름' }}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    // 편집 중이던 값 유지.
    expect(
      (screen.getByTestId('rename-classroom-name-input') as HTMLInputElement).value,
    ).toBe('수학 심화');
  });

  it('F100 대칭: label htmlFor/id 연결 (name, section)', () => {
    renderWithClient(
      <RenameClassroomDialog
        open={true}
        onOpenChange={vi.fn()}
        target={{ id: 'c1', name: '수학' }}
      />,
    );
    expect(document.querySelector('label[for="rename-classroom-name-input"]')).toBeTruthy();
    expect(document.querySelector('#rename-classroom-name-input')).toBeTruthy();
    expect(document.querySelector('label[for="rename-classroom-section-input"]')).toBeTruthy();
    expect(document.querySelector('#rename-classroom-section-input')).toBeTruthy();
  });

  it('취소 → onOpenChange(false) 호출', () => {
    const onOpenChange = vi.fn();
    renderWithClient(
      <RenameClassroomDialog
        open={true}
        onOpenChange={onOpenChange}
        target={{ id: 'c1', name: '수학' }}
      />,
    );
    fireEvent.click(screen.getByTestId('rename-classroom-cancel-btn'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('target=null 이어도 crash 안 함 (초기 로딩 상태)', () => {
    renderWithClient(
      <RenameClassroomDialog open={true} onOpenChange={vi.fn()} target={null} />,
    );
    // 저장 disabled — target 없으므로 anyChanged false.
    expect(
      (screen.getByTestId('rename-classroom-confirm-btn') as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
