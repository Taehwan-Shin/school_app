import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UserAuditTrail } from '../src/routes/admin/UserAuditTrail';
import type { AuditLogEntryRead } from '../src/api/auditLogList';

const mockUseAuditLogList = vi.fn();

vi.mock('../src/api/auditLogList', () => ({
  useAuditLogList: (pageSize?: number, filters?: any) => mockUseAuditLogList(pageSize, filters),
}));

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('UserAuditTrail component', () => {
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

  it('scenario 1: renders loading indicator when loading is true and entries are empty', () => {
    mockUseAuditLogList.mockReturnValue({
      ...defaultMockReturn,
      loading: true,
      entries: [],
    });

    renderWithRouter(<UserAuditTrail targetEmail="user@cam.hs.kr" />);
    expect(screen.getByTestId('user-audit-loading')).toBeDefined();
    expect(screen.getByText('이력을 불러오는 중...')).toBeDefined();
  });

  it('scenario 2: renders error message when error occurs', () => {
    mockUseAuditLogList.mockReturnValue({
      ...defaultMockReturn,
      loading: false,
      error: new Error('Network error'),
    });

    renderWithRouter(<UserAuditTrail targetEmail="user@cam.hs.kr" />);
    expect(screen.getByTestId('user-audit-error')).toBeDefined();
    expect(screen.getByText('이력을 불러오지 못했습니다: Network error')).toBeDefined();
  });

  it('scenario 3: renders empty message when not loading, no error, and entries are empty', () => {
    mockUseAuditLogList.mockReturnValue({
      ...defaultMockReturn,
      loading: false,
      error: null,
      entries: [],
    });

    renderWithRouter(<UserAuditTrail targetEmail="user@cam.hs.kr" />);
    expect(screen.getByTestId('user-audit-empty')).toBeDefined();
    expect(screen.getByText('이 사용자에 대한 감사 이력이 없습니다.')).toBeDefined();
  });

  it('scenario 4: renders 3 entries accurately and load more button when hasMore is true', () => {
    const mockLoadMore = vi.fn();
    const mockEntries: AuditLogEntryRead[] = [
      {
        id: 'entry-1',
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'users.update',
        target: 'user@cam.hs.kr',
        request_id: 'req-1',
        result: 'ok',
        at: 1725150000000,
        message: '부서 변경',
      },
      {
        id: 'entry-2',
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'users.resetPassword',
        target: 'user@cam.hs.kr',
        request_id: 'req-2',
        result: 'error',
        at: 1725151000000,
        message: '비밀번호 재설정 실패',
      },
      {
        id: 'entry-3',
        actor: 'super@cam.hs.kr',
        role: 'super_admin',
        action: 'users.suspend',
        target: 'user@cam.hs.kr',
        request_id: 'req-3',
        result: 'denied',
        at: 1725152000000,
        message: '권한 없음',
      },
    ];

    mockUseAuditLogList.mockReturnValue({
      ...defaultMockReturn,
      entries: mockEntries,
      hasMore: true,
      loadMore: mockLoadMore,
    });

    renderWithRouter(<UserAuditTrail targetEmail="user@cam.hs.kr" />);

    expect(mockUseAuditLogList).toHaveBeenCalledWith(25, { filterTarget: 'user@cam.hs.kr' });

    expect(screen.getByTestId('user-audit-row-entry-1')).toBeDefined();
    expect(screen.getByTestId('user-audit-row-entry-2')).toBeDefined();
    expect(screen.getByTestId('user-audit-row-entry-3')).toBeDefined();

    expect(screen.getByText('부서 변경')).toBeDefined();
    expect(screen.getByText('비밀번호 재설정 실패')).toBeDefined();
    expect(screen.getByText('권한 없음')).toBeDefined();

    const loadMoreBtn = screen.getByTestId('user-audit-load-more');
    expect(loadMoreBtn).toBeDefined();
    expect(loadMoreBtn.textContent).toBe('더 보기 (25 건)');

    fireEvent.click(loadMoreBtn);
    expect(mockLoadMore).toHaveBeenCalledTimes(1);
  });

  it('scenario 5: renders actor as user detail link when ending with @cam.hs.kr, and plain text for non-domain actor', () => {
    const mockEntries: AuditLogEntryRead[] = [
      {
        id: 'entry-1',
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'users.update',
        target: 'user@cam.hs.kr',
        request_id: 'req-1',
        result: 'ok',
        at: 1725150000000,
      },
      {
        id: 'entry-2',
        actor: 'unknown',
        role: 'unknown',
        action: 'system.sync',
        target: 'user@cam.hs.kr',
        request_id: 'req-2',
        result: 'ok',
        at: 1725151000000,
      },
    ];

    mockUseAuditLogList.mockReturnValue({
      ...defaultMockReturn,
      entries: mockEntries,
    });

    renderWithRouter(<UserAuditTrail targetEmail="user@cam.hs.kr" />);

    const link = screen.getByTestId('audit-actor-link-admin@cam.hs.kr');
    expect(link).toBeDefined();
    expect(link.getAttribute('href')).toBe('/admin/users/admin%40cam.hs.kr');
    expect(link.textContent).toBe('admin@cam.hs.kr');

    expect(screen.queryByTestId('audit-actor-link-unknown')).toBeNull();
    expect(screen.getByText('unknown')).toBeDefined();
  });
});

