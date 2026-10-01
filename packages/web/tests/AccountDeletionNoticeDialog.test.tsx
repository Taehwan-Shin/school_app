import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockGmailSend = vi.fn();
const mockUpsert = vi.fn();
let mockTemplates: { id: string; name: string; subject: string; body: string }[] = [];

vi.mock('../src/api/messages', () => ({
  callGmailSend: (...a: unknown[]) => mockGmailSend(...a),
  useMessageTemplates: () => ({ data: { templates: mockTemplates }, isLoading: false, isError: false, error: null }),
  useUpsertMessageTemplate: () => ({ mutateAsync: mockUpsert, isPending: false, error: null, reset: vi.fn() }),
}));
vi.mock('../src/lib/auth', () => ({ reauthorizeWithGoogle: vi.fn() }));

import { AccountDeletionNoticeDialog } from '../src/routes/admin/AccountDeletionNoticeDialog';

const recipients = [
  { email: 's1@cam.hs.kr', name: '홍길동' },
  { email: 's2@cam.hs.kr', name: '김철수' },
];

describe('AccountDeletionNoticeDialog (v0.322)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTemplates = [];
  });

  it('저장된 문구 없음 → 기본 문구 + 안내 · 미리보기는 첫 수신자로 치환', () => {
    render(<AccountDeletionNoticeDialog open onOpenChange={vi.fn()} recipients={recipients} />);
    expect(screen.getByTestId('deletion-notice-default-hint')).toBeTruthy();
    const preview = screen.getByTestId('deletion-notice-preview').textContent ?? '';
    expect(preview).toContain('홍길동 학생에게');
    expect(preview).toContain('s1@cam.hs.kr');
    expect(preview).not.toContain('{{');
  });

  it('저장된 문구 자동 로드 → 발송 시 수신자별 치환 · 순차 발송 · 결과', async () => {
    mockTemplates = [{ id: 'account_deletion_notice', name: '계정 삭제 안내', subject: '{{name}} 안내', body: '{{email}} 삭제 예정' }];
    mockGmailSend.mockResolvedValueOnce({ id: '1' }).mockRejectedValueOnce(new Error('google_upstream_denied: x'));
    render(<AccountDeletionNoticeDialog open onOpenChange={vi.fn()} recipients={recipients} />);
    expect((screen.getByTestId('deletion-notice-subject') as HTMLInputElement).value).toBe('{{name}} 안내');
    fireEvent.click(screen.getByTestId('deletion-notice-send'));
    await waitFor(() => expect(screen.getByTestId('deletion-notice-done')).toBeTruthy());
    expect(mockGmailSend).toHaveBeenNthCalledWith(1, { to: 's1@cam.hs.kr', subject: '홍길동 안내', body: 's1@cam.hs.kr 삭제 예정' });
    expect(mockGmailSend).toHaveBeenNthCalledWith(2, { to: 's2@cam.hs.kr', subject: '김철수 안내', body: 's2@cam.hs.kr 삭제 예정' });
    expect(screen.getByTestId('deletion-notice-done-failures').textContent).toContain('s2@cam.hs.kr');
  }, 10000);

  it('문구 수정 → 「문구 저장」 이 account_deletion_notice 로 upsert', async () => {
    mockUpsert.mockResolvedValueOnce({ template: {} });
    render(<AccountDeletionNoticeDialog open onOpenChange={vi.fn()} recipients={recipients} />);
    fireEvent.change(screen.getByTestId('deletion-notice-body'), { target: { value: '새 문구 {{name}}' } });
    fireEvent.click(screen.getByTestId('deletion-notice-save'));
    await waitFor(() =>
      expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({ id: 'account_deletion_notice', body: '새 문구 {{name}}' })),
    );
    expect(screen.getByTestId('deletion-notice-saved')).toBeTruthy();
  });

  it('scope 부족 실패 → 재로그인 안내 표시', async () => {
    mockGmailSend.mockRejectedValue(new Error('insufficient_scope:https://www.googleapis.com/auth/gmail.send'));
    render(<AccountDeletionNoticeDialog open onOpenChange={vi.fn()} recipients={[recipients[0]]} />);
    fireEvent.click(screen.getByTestId('deletion-notice-send'));
    await waitFor(() => expect(screen.getByTestId('deletion-notice-done-reauth-hint')).toBeTruthy());
  });

  it('본문 비우면 발송 비활성', () => {
    render(<AccountDeletionNoticeDialog open onOpenChange={vi.fn()} recipients={recipients} />);
    fireEvent.change(screen.getByTestId('deletion-notice-body'), { target: { value: '  ' } });
    expect((screen.getByTestId('deletion-notice-send') as HTMLButtonElement).disabled).toBe(true);
  });
});
