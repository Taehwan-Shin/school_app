import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuditTrail } from '../src/routes/admin/AuditTrail';
import type { AuditLogEntryRead } from '../src/api/auditLogList';

// v0.299: shared AuditTrail 컴포넌트 직접 회귀 (UserAuditTrail/GroupAuditTrail wrapper
// 우회). 목적: testIdPrefix · tableAriaLabel · emptyMessage prop propagation 이 hardcode 없이
// 실제로 caller 지식을 반영하는지 강제. wrapper 테스트는 각각 고정 prefix 만 커버 → 이 파일은
// 임의 prefix / 메시지 / aria-label 로 계약 강제.

const mockUseAuditLogList = vi.fn();

vi.mock('../src/api/auditLogList', () => ({
  useAuditLogList: (pageSize?: number, filters?: unknown) =>
    mockUseAuditLogList(pageSize, filters),
}));

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

const baseMock = {
  entries: [] as AuditLogEntryRead[],
  loading: false,
  error: null as Error | null,
  hasMore: false,
  loadMore: vi.fn(),
  reload: vi.fn(),
};

describe('AuditTrail shared component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuditLogList.mockReturnValue({ ...baseMock });
  });

  it('useAuditLogList 호출: pageSize=25 · filterTarget=props.targetEmail', () => {
    renderWithRouter(
      <AuditTrail
        targetEmail="alice@example.com"
        testIdPrefix="custom-audit"
        tableAriaLabel="Custom Audit"
        emptyMessage="No entries."
      />,
    );
    expect(mockUseAuditLogList).toHaveBeenCalledWith(25, {
      filterTarget: 'alice@example.com',
    });
  });

  it('testIdPrefix propagation: loading state 는 `${prefix}-loading`', () => {
    mockUseAuditLogList.mockReturnValue({ ...baseMock, loading: true });
    renderWithRouter(
      <AuditTrail
        targetEmail="alice@example.com"
        testIdPrefix="xyz"
        tableAriaLabel="X"
        emptyMessage="none"
      />,
    );
    expect(screen.getByTestId('xyz-loading')).toBeDefined();
  });

  it('testIdPrefix propagation: error banner 는 `${prefix}-error`', () => {
    mockUseAuditLogList.mockReturnValue({
      ...baseMock,
      error: new Error('boom'),
    });
    renderWithRouter(
      <AuditTrail
        targetEmail="alice@example.com"
        testIdPrefix="xyz"
        tableAriaLabel="X"
        emptyMessage="none"
      />,
    );
    expect(screen.getByTestId('xyz-error')).toBeDefined();
    expect(screen.getByText('이력을 불러오지 못했습니다: boom')).toBeDefined();
  });

  it('emptyMessage prop 은 caller 문구 반영 (hardcode 아님)', () => {
    renderWithRouter(
      <AuditTrail
        targetEmail="alice@example.com"
        testIdPrefix="xyz"
        tableAriaLabel="X"
        emptyMessage="ARBITRARY_EMPTY_TEXT"
      />,
    );
    expect(screen.getByTestId('xyz-empty')).toBeDefined();
    expect(screen.getByText('ARBITRARY_EMPTY_TEXT')).toBeDefined();
  });

  it('tableAriaLabel prop 은 Table aria-label 로 반영', () => {
    mockUseAuditLogList.mockReturnValue({
      ...baseMock,
      entries: [
        {
          id: 'e1',
          actor: 'admin@cam.hs.kr',
          role: 'admin',
          action: 'users.update',
          target: 'x@y',
          request_id: 'r',
          result: 'ok',
          at: 1725150000000,
        },
      ] as AuditLogEntryRead[],
    });
    renderWithRouter(
      <AuditTrail
        targetEmail="x@y"
        testIdPrefix="xyz"
        tableAriaLabel="ARBITRARY_TABLE_LABEL"
        emptyMessage="none"
      />,
    );
    const table = screen.getByRole('table');
    expect(table.getAttribute('aria-label')).toBe('ARBITRARY_TABLE_LABEL');
  });

  it('row testId 도 prefix 전파: `${prefix}-row-${id}`', () => {
    mockUseAuditLogList.mockReturnValue({
      ...baseMock,
      entries: [
        {
          id: 'foo',
          actor: 'a@b',
          role: 'admin',
          action: 'x',
          target: 'y',
          request_id: 'r',
          result: 'ok',
          at: 1725150000000,
        },
        {
          id: 'bar',
          actor: 'a@b',
          role: 'admin',
          action: 'x',
          target: 'y',
          request_id: 'r',
          result: 'ok',
          at: 1725150001000,
        },
      ] as AuditLogEntryRead[],
    });
    renderWithRouter(
      <AuditTrail
        targetEmail="y"
        testIdPrefix="pre"
        tableAriaLabel="X"
        emptyMessage="none"
      />,
    );
    expect(screen.getByTestId('pre-row-foo')).toBeDefined();
    expect(screen.getByTestId('pre-row-bar')).toBeDefined();
  });

  it('load-more 버튼: prefix 전파 + click 이 loadMore 호출', () => {
    const loadMore = vi.fn();
    mockUseAuditLogList.mockReturnValue({
      ...baseMock,
      entries: [
        {
          id: 'e1',
          actor: 'a@b',
          role: 'admin',
          action: 'x',
          target: 'y',
          request_id: 'r',
          result: 'ok',
          at: 1725150000000,
        },
      ] as AuditLogEntryRead[],
      hasMore: true,
      loadMore,
    });
    renderWithRouter(
      <AuditTrail
        targetEmail="y"
        testIdPrefix="pre"
        tableAriaLabel="X"
        emptyMessage="none"
      />,
    );
    const btn = screen.getByTestId('pre-load-more');
    expect(btn.textContent).toBe('더 보기 (25 건)');
    fireEvent.click(btn);
    expect(loadMore).toHaveBeenCalledOnce();
  });

  it('actor @cam.hs.kr suffix → /admin/users 링크, 그 외 → span (도메인 하드코드 회귀 방어)', () => {
    mockUseAuditLogList.mockReturnValue({
      ...baseMock,
      entries: [
        {
          id: 'e1',
          actor: 'admin@cam.hs.kr',
          role: 'admin',
          action: 'x',
          target: 'y',
          request_id: 'r',
          result: 'ok',
          at: 1725150000000,
        },
        {
          id: 'e2',
          actor: 'system-cron',
          role: 'system',
          action: 'x',
          target: 'y',
          request_id: 'r',
          result: 'ok',
          at: 1725150001000,
        },
      ] as AuditLogEntryRead[],
    });
    renderWithRouter(
      <AuditTrail
        targetEmail="y"
        testIdPrefix="pre"
        tableAriaLabel="X"
        emptyMessage="none"
      />,
    );
    const link = screen.getByTestId('audit-actor-link-admin@cam.hs.kr');
    expect(link.getAttribute('href')).toBe('/admin/users/admin%40cam.hs.kr');
    expect(screen.queryByTestId('audit-actor-link-system-cron')).toBeNull();
    expect(screen.getByText('system-cron')).toBeDefined();
  });
});
