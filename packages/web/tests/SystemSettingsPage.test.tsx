import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

const mockUpsert = vi.fn();
const mockDelete = vi.fn();
let mockTemplates = [
  { id: 'account_deletion_notice', name: '계정 삭제 안내', subject: '안내', body: '{{name}}', updatedBy: 'admin@cam.hs.kr', updatedAt: null },
  { id: 't_1', name: '수행평가', subject: '', body: '제출', updatedBy: 'teacher@cam.hs.kr', updatedAt: null },
];

vi.mock('../src/components/shell/AppShell', () => ({ AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('../src/lib/auth', () => ({ useAuth: () => ({ role: 'super_admin' }) }));
vi.mock('../src/routes/admin/BasicDataPanel', () => ({ BasicDataPanel: () => <div data-testid="basic-data-panel-stub" /> }));
let mockUpsertPending = false;
let mockDeletePending = false;
vi.mock('../src/api/messages', () => ({
  useMessageTemplates: () => ({ data: { templates: mockTemplates }, isLoading: false, isError: false, error: null }),
  useUpsertMessageTemplate: () => ({ mutateAsync: mockUpsert, isPending: mockUpsertPending, error: null }),
  useDeleteMessageTemplate: () => ({ mutateAsync: mockDelete, isPending: mockDeletePending, error: null }),
}));

import { SystemSettingsPage } from '../src/routes/super_admin/settings';

function renderPage() {
  return render(
    <MemoryRouter>
      <SystemSettingsPage />
    </MemoryRouter>,
  );
}

describe('SystemSettingsPage (v0.334)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('메시지 문구 목록 → 수정 → 저장 payload', async () => {
    mockUpsert.mockResolvedValueOnce({});
    renderPage();
    expect(screen.getByTestId('settings-template-list').textContent).toContain('계정 삭제 안내');
    fireEvent.click(screen.getByTestId('settings-template-edit-t_1'));
    fireEvent.change(screen.getByLabelText('본문'), { target: { value: '새 본문' } });
    fireEvent.click(screen.getByTestId('settings-template-save'));
    await waitFor(() =>
      expect(mockUpsert).toHaveBeenCalledWith({ id: 't_1', name: '수행평가', subject: '', body: '새 본문' }),
    );
    expect(screen.getByTestId('settings-template-banner').textContent).toContain('저장');
  });

  it('새 문구: 이름 · 본문 없으면 저장 비활성', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('settings-template-new'));
    expect((screen.getByTestId('settings-template-save') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('이름'), { target: { value: '공지' } });
    fireEvent.change(screen.getByLabelText('본문'), { target: { value: '내용' } });
    expect((screen.getByTestId('settings-template-save') as HTMLButtonElement).disabled).toBe(false);
  });

  it('삭제 확인 → delete(id)', async () => {
    mockDelete.mockResolvedValueOnce({});
    renderPage();
    fireEvent.click(screen.getByTestId('settings-template-delete-t_1'));
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith({ id: 't_1' }));
  });

  it('역할 · 권한 / 기초 데이터 탭', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('settings-tab-roles'));
    expect(screen.getByTestId('settings-roles-matrix-link').getAttribute('href')).toBe('/super_admin/capabilities');
    fireEvent.click(screen.getByTestId('settings-tab-basic'));
    expect(screen.getByTestId('basic-data-panel-stub')).toBeTruthy();
  });

  it('v0.335: 저장/삭제 요청 중에는 새 문구 · 수정 · 삭제 · 취소 비활성', () => {
    mockUpsertPending = true;
    renderPage();
    expect((screen.getByTestId('settings-template-new') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('settings-template-edit-t_1') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('settings-template-delete-t_1') as HTMLButtonElement).disabled).toBe(true);
    mockUpsertPending = false;
  });

  it('v0.336: busy 중 편집기 입력칸 · 저장 버튼 잠금 (삭제 진행 중 포함)', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('settings-template-edit-t_1'));
    mockDeletePending = true;
    // 재렌더 유도.
    fireEvent.change(screen.getByLabelText('본문'), { target: { value: '변경' } });
    expect((screen.getByLabelText('이름') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText('본문') as HTMLTextAreaElement).disabled).toBe(true);
    expect((screen.getByTestId('settings-template-save') as HTMLButtonElement).disabled).toBe(true);
    mockDeletePending = false;
  });

  it('v0.335: A 삭제 완료 시 열려 있는 B 편집기는 닫지 않음 (최신 draft 기준)', async () => {
    let resolveDelete: () => void = () => {};
    mockDelete.mockImplementationOnce(() => new Promise<void>((r) => (resolveDelete = r)));
    renderPage();
    fireEvent.click(screen.getByTestId('settings-template-edit-account_deletion_notice'));
    fireEvent.click(screen.getByTestId('settings-template-delete-t_1'));
    resolveDelete();
    await waitFor(() => expect(screen.getByTestId('settings-template-banner').textContent).toContain('삭제'));
    expect(screen.getByTestId('settings-template-editor')).toBeTruthy();
    expect((screen.getByLabelText('이름') as HTMLInputElement).value).toBe('계정 삭제 안내');
  });

  it('v0.335: 삭제된 문구의 편집기는 닫힘', async () => {
    mockDelete.mockResolvedValueOnce({});
    renderPage();
    fireEvent.click(screen.getByTestId('settings-template-edit-t_1'));
    fireEvent.click(screen.getByTestId('settings-template-delete-t_1'));
    await waitFor(() => expect(screen.queryByTestId('settings-template-editor')).toBeNull());
  });

  it('문구 없음 안내', () => {
    mockTemplates = [];
    renderPage();
    expect(screen.getByTestId('settings-template-empty')).toBeTruthy();
  });
});
