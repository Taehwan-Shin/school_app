import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuditLogTable } from '../src/routes/super_admin/AuditLogTable';
import type { AuditLogEntryRead } from '../src/api/auditLogList';

const mockUseAuditLogList = vi.fn();

vi.mock('../src/api/auditLogList', () => ({
  useAuditLogList: () => mockUseAuditLogList(),
}));

describe('AuditLogTable component', () => {
  const defaultMockReturn = {
    entries: [] as AuditLogEntryRead[],
    loading: false,
    error: null,
    hasMore: false,
    loadMore: vi.fn(),
    reload: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuditLogList.mockReturnValue({ ...defaultMockReturn });
  });

  it('renders loading state when loading is true and entries are empty', () => {
    mockUseAuditLogList.mockReturnValue({
      ...defaultMockReturn,
      loading: true,
      entries: [],
    });

    render(<AuditLogTable />);

    expect(screen.getByTestId('audit-log-loading')).toBeDefined();
    expect(screen.getByText('감사 로그를 불러오는 중...')).toBeDefined();
  });

  it('renders table rows and columns correctly when entries are provided', () => {
    const mockEntries: AuditLogEntryRead[] = [
      {
        id: 'log-1',
        actor: 'super@cam.hs.kr',
        role: 'super_admin',
        action: 'users.delete',
        target: 'bad@cam.hs.kr',
        request_id: 'req-long-uuid-12345678',
        result: 'ok',
        at: 1725150000000,
        message: '사용자 영구 삭제',
      },
      {
        id: 'log-2',
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'users.update',
        target: 'teacher@cam.hs.kr',
        request_id: 'short-id',
        result: 'error',
        at: 1725140000000,
        message: '수정 실패',
      },
      {
        id: 'log-3',
        actor: 'anon@cam.hs.kr',
        role: 'unknown',
        action: 'audit.read',
        target: '*',
        request_id: 'req-denied-001',
        result: 'denied',
        at: 1725130000000,
        message: '권한 없음',
      },
    ];

    mockUseAuditLogList.mockReturnValue({
      ...defaultMockReturn,
      entries: mockEntries,
    });

    render(<AuditLogTable />);

    expect(screen.getByTestId('audit-log-row-log-1')).toBeDefined();
    expect(screen.getByTestId('audit-log-row-log-2')).toBeDefined();
    expect(screen.getByTestId('audit-log-row-log-3')).toBeDefined();

    expect(screen.getByText('super@cam.hs.kr')).toBeDefined();
    expect(screen.getByText('users.delete')).toBeDefined();
    expect(screen.getByText('bad@cam.hs.kr')).toBeDefined();
    expect(screen.getByText('12345678')).toBeDefined(); // short request_id (last 8 chars)
    expect(screen.getByText('사용자 영구 삭제')).toBeDefined();

    expect(screen.getByText('admin@cam.hs.kr')).toBeDefined();
    expect(screen.getByText('error')).toBeDefined();

    expect(screen.getByText('denied')).toBeDefined();
  });

  it('renders load-more button when hasMore is true and triggers loadMore on click', () => {
    const mockLoadMore = vi.fn();
    const mockEntries: AuditLogEntryRead[] = [
      {
        id: 'log-1',
        actor: 'super@cam.hs.kr',
        role: 'super_admin',
        action: 'users.read',
        target: '*',
        request_id: 'req-001',
        result: 'ok',
        at: 1725150000000,
      },
    ];

    mockUseAuditLogList.mockReturnValue({
      ...defaultMockReturn,
      entries: mockEntries,
      hasMore: true,
      loadMore: mockLoadMore,
    });

    render(<AuditLogTable />);

    const loadMoreButton = screen.getByTestId('audit-log-load-more');
    expect(loadMoreButton).toBeDefined();
    expect(loadMoreButton.textContent).toContain('더 보기 (25 건)');

    fireEvent.click(loadMoreButton);
    expect(mockLoadMore).toHaveBeenCalledTimes(1);
  });

  it('does not render load-more button when hasMore is false', () => {
    const mockEntries: AuditLogEntryRead[] = [
      {
        id: 'log-1',
        actor: 'super@cam.hs.kr',
        role: 'super_admin',
        action: 'users.read',
        target: '*',
        request_id: 'req-001',
        result: 'ok',
        at: 1725150000000,
      },
    ];

    mockUseAuditLogList.mockReturnValue({
      ...defaultMockReturn,
      entries: mockEntries,
      hasMore: false,
    });

    render(<AuditLogTable />);

    expect(screen.queryByTestId('audit-log-load-more')).toBeNull();
  });

  it('renders empty state when not loading, no error, and 0 entries', () => {
    mockUseAuditLogList.mockReturnValue({
      ...defaultMockReturn,
      entries: [],
      loading: false,
      error: null,
    });

    render(<AuditLogTable />);

    expect(screen.getByTestId('audit-log-empty')).toBeDefined();
    expect(screen.getByText('감사 로그 항목이 없습니다.')).toBeDefined();
  });

  it('renders error banner when error occurs', () => {
    mockUseAuditLogList.mockReturnValue({
      ...defaultMockReturn,
      error: new Error('permission-denied: requires super_admin role'),
    });

    render(<AuditLogTable />);

    const errorBanner = screen.getByTestId('audit-log-error');
    expect(errorBanner).toBeDefined();
    expect(errorBanner.textContent).toBe('이 기능은 최고 관리자만 사용할 수 있습니다.');
  });

  it('triggers reload when refresh button is clicked', () => {
    const mockReload = vi.fn();
    mockUseAuditLogList.mockReturnValue({
      ...defaultMockReturn,
      reload: mockReload,
    });

    render(<AuditLogTable />);

    const reloadButton = screen.getByTestId('audit-log-reload');
    expect(reloadButton).toBeDefined();

    fireEvent.click(reloadButton);
    expect(mockReload).toHaveBeenCalledTimes(1);
  });
});
