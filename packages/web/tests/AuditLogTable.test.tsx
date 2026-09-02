import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AuditLogTable } from '../src/routes/super_admin/AuditLogTable';
import type { AuditLogEntryRead } from '../src/api/auditLogList';

const mockUseAuditLogList = vi.fn();

vi.mock('../src/api/auditLogList', () => ({
  useAuditLogList: () => mockUseAuditLogList(),
}));

function renderWithRouter(ui: React.ReactElement, initialEntries: string[] = ['/super_admin/audit']) {
  return render(<MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>);
}

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

    renderWithRouter(<AuditLogTable />);

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

    renderWithRouter(<AuditLogTable />);

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

    renderWithRouter(<AuditLogTable />);

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

    renderWithRouter(<AuditLogTable />);

    expect(screen.queryByTestId('audit-log-load-more')).toBeNull();
  });

  it('renders empty state when not loading, no error, and 0 entries', () => {
    mockUseAuditLogList.mockReturnValue({
      ...defaultMockReturn,
      entries: [],
      loading: false,
      error: null,
    });

    renderWithRouter(<AuditLogTable />);

    expect(screen.getByTestId('audit-log-empty')).toBeDefined();
    expect(screen.getByText('감사 로그 항목이 없습니다.')).toBeDefined();
  });

  it('renders error banner when error occurs', () => {
    mockUseAuditLogList.mockReturnValue({
      ...defaultMockReturn,
      error: new Error('permission-denied: requires super_admin role'),
    });

    renderWithRouter(<AuditLogTable />);

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

    renderWithRouter(<AuditLogTable />);

    const reloadButton = screen.getByTestId('audit-log-reload');
    expect(reloadButton).toBeDefined();

    fireEvent.click(reloadButton);
    expect(mockReload).toHaveBeenCalledTimes(1);
  });

  it('filters table rows by result filter dropdown', () => {
    const mockEntries: AuditLogEntryRead[] = [
      {
        id: 'log-1',
        actor: 'super@cam.hs.kr',
        role: 'super_admin',
        action: 'users.delete',
        target: 'bad@cam.hs.kr',
        request_id: 'req-1',
        result: 'ok',
        at: 1725150000000,
      },
      {
        id: 'log-2',
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'users.update',
        target: 'teacher@cam.hs.kr',
        request_id: 'req-2',
        result: 'error',
        at: 1725140000000,
      },
      {
        id: 'log-3',
        actor: 'anon@cam.hs.kr',
        role: 'unknown',
        action: 'audit.read',
        target: '*',
        request_id: 'req-3',
        result: 'denied',
        at: 1725130000000,
      },
    ];

    mockUseAuditLogList.mockReturnValue({
      ...defaultMockReturn,
      entries: mockEntries,
    });

    renderWithRouter(<AuditLogTable />);

    expect(screen.getByTestId('audit-log-row-log-1')).toBeDefined();
    expect(screen.getByTestId('audit-log-row-log-2')).toBeDefined();
    expect(screen.getByTestId('audit-log-row-log-3')).toBeDefined();

    const select = screen.getByTestId('audit-log-filter-result');
    fireEvent.change(select, { target: { value: 'denied' } });

    expect(screen.getByTestId('audit-log-row-log-3')).toBeDefined();
    expect(screen.queryByTestId('audit-log-row-log-1')).toBeNull();
    expect(screen.queryByTestId('audit-log-row-log-2')).toBeNull();
    expect(screen.getByText(/1건 표시됨 \/ 전체 3건/)).toBeDefined();
  });

  it('filters table rows by action search input', () => {
    const mockEntries: AuditLogEntryRead[] = [
      {
        id: 'log-1',
        actor: 'super@cam.hs.kr',
        role: 'super_admin',
        action: 'users.delete',
        target: 'bad@cam.hs.kr',
        request_id: 'req-1',
        result: 'ok',
        at: 1725150000000,
      },
      {
        id: 'log-2',
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'users.update',
        target: 'teacher@cam.hs.kr',
        request_id: 'req-2',
        result: 'error',
        at: 1725140000000,
      },
      {
        id: 'log-3',
        actor: 'anon@cam.hs.kr',
        role: 'unknown',
        action: 'audit.read',
        target: '*',
        request_id: 'req-3',
        result: 'denied',
        at: 1725130000000,
      },
    ];

    mockUseAuditLogList.mockReturnValue({
      ...defaultMockReturn,
      entries: mockEntries,
    });

    renderWithRouter(<AuditLogTable />);

    const input = screen.getByTestId('audit-log-filter-action');
    fireEvent.change(input, { target: { value: 'users' } });

    expect(screen.getByTestId('audit-log-row-log-1')).toBeDefined();
    expect(screen.getByTestId('audit-log-row-log-2')).toBeDefined();
    expect(screen.queryByTestId('audit-log-row-log-3')).toBeNull();
    expect(screen.getByText(/2건 표시됨 \/ 전체 3건/)).toBeDefined();
  });

  it('filters table rows by combining result filter and action search', () => {
    const mockEntries: AuditLogEntryRead[] = [
      {
        id: 'log-1',
        actor: 'super@cam.hs.kr',
        role: 'super_admin',
        action: 'users.delete',
        target: 'bad@cam.hs.kr',
        request_id: 'req-1',
        result: 'ok',
        at: 1725150000000,
      },
      {
        id: 'log-2',
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'users.update',
        target: 'teacher@cam.hs.kr',
        request_id: 'req-2',
        result: 'error',
        at: 1725140000000,
      },
      {
        id: 'log-3',
        actor: 'anon@cam.hs.kr',
        role: 'unknown',
        action: 'audit.read',
        target: '*',
        request_id: 'req-3',
        result: 'denied',
        at: 1725130000000,
      },
      {
        id: 'log-4',
        actor: 'hacker@cam.hs.kr',
        role: 'unknown',
        action: 'users.export',
        target: '*',
        request_id: 'req-4',
        result: 'denied',
        at: 1725120000000,
      },
    ];

    mockUseAuditLogList.mockReturnValue({
      ...defaultMockReturn,
      entries: mockEntries,
    });

    renderWithRouter(<AuditLogTable />);

    const select = screen.getByTestId('audit-log-filter-result');
    const input = screen.getByTestId('audit-log-filter-action');

    fireEvent.change(select, { target: { value: 'denied' } });
    fireEvent.change(input, { target: { value: 'users' } });

    expect(screen.getByTestId('audit-log-row-log-4')).toBeDefined();
    expect(screen.queryByTestId('audit-log-row-log-1')).toBeNull();
    expect(screen.queryByTestId('audit-log-row-log-2')).toBeNull();
    expect(screen.queryByTestId('audit-log-row-log-3')).toBeNull();
    expect(screen.getByText(/1건 표시됨 \/ 전체 4건/)).toBeDefined();

    // When filter matches 0 entries, empty state should appear
    fireEvent.change(input, { target: { value: 'groups' } });
    expect(screen.getByTestId('audit-log-filter-empty')).toBeDefined();
    expect(screen.getByText('필터에 매칭되는 로그가 없습니다.')).toBeDefined();
    expect(screen.getByText(/0건 표시됨 \/ 전체 4건/)).toBeDefined();
  });

  it('applies result filter from initial URL search params (?result=denied)', () => {
    const mockEntries: AuditLogEntryRead[] = [
      {
        id: 'log-1',
        actor: 'super@cam.hs.kr',
        role: 'super_admin',
        action: 'users.delete',
        target: 'bad@cam.hs.kr',
        request_id: 'req-1',
        result: 'ok',
        at: 1725150000000,
      },
      {
        id: 'log-2',
        actor: 'anon@cam.hs.kr',
        role: 'unknown',
        action: 'audit.read',
        target: '*',
        request_id: 'req-2',
        result: 'denied',
        at: 1725130000000,
      },
    ];

    mockUseAuditLogList.mockReturnValue({
      ...defaultMockReturn,
      entries: mockEntries,
    });

    renderWithRouter(<AuditLogTable />, ['/super_admin/audit?result=denied']);

    const select = screen.getByTestId('audit-log-filter-result') as HTMLSelectElement;
    expect(select.value).toBe('denied');
    expect(screen.getByTestId('audit-log-row-log-2')).toBeDefined();
    expect(screen.queryByTestId('audit-log-row-log-1')).toBeNull();
    expect(screen.getByText(/1건 표시됨 \/ 전체 2건/)).toBeDefined();
  });

  it('updates URL search params when result dropdown and action search change', () => {
    let capturedSearch = '';
    function LocationSpy() {
      const location = useLocation();
      capturedSearch = location.search;
      return null;
    }

    const mockEntries: AuditLogEntryRead[] = [
      {
        id: 'log-1',
        actor: 'super@cam.hs.kr',
        role: 'super_admin',
        action: 'users.delete',
        target: 'bad@cam.hs.kr',
        request_id: 'req-1',
        result: 'ok',
        at: 1725150000000,
      },
    ];

    mockUseAuditLogList.mockReturnValue({
      ...defaultMockReturn,
      entries: mockEntries,
    });

    render(
      <MemoryRouter initialEntries={['/super_admin/audit']}>
        <LocationSpy />
        <AuditLogTable />
      </MemoryRouter>
    );

    const select = screen.getByTestId('audit-log-filter-result');
    fireEvent.change(select, { target: { value: 'denied' } });
    expect(capturedSearch).toBe('?result=denied');

    const input = screen.getByTestId('audit-log-filter-action');
    fireEvent.change(input, { target: { value: 'users' } });
    expect(capturedSearch).toBe('?result=denied&q=users');

    fireEvent.change(select, { target: { value: 'all' } });
    expect(capturedSearch).toBe('?q=users');

    fireEvent.change(input, { target: { value: '' } });
    expect(capturedSearch).toBe('');
  });
});
