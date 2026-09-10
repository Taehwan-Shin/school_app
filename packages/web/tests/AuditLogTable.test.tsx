import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AuditLogTable } from '../src/routes/super_admin/AuditLogTable';
import type { AuditLogEntryRead } from '../src/api/auditLogList';

const mockUseAuditLogList = vi.fn();

vi.mock('../src/api/auditLogList', () => ({
  useAuditLogList: (pageSize?: number, filters?: any) => mockUseAuditLogList(pageSize, filters),
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
    // dropdown option 도 같은 텍스트를 가지므로 getAllByText — 표 셀 존재만 확인.
    expect(screen.getAllByText('users.delete').length).toBeGreaterThan(0);
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

    mockUseAuditLogList.mockImplementation((_pageSize?: number, filters?: any) => {
      const filtered = filters?.filterResult
        ? mockEntries.filter((e) => e.result === filters.filterResult)
        : mockEntries;
      return {
        ...defaultMockReturn,
        entries: filtered,
      };
    });

    renderWithRouter(<AuditLogTable />);

    expect(screen.getByTestId('audit-log-row-log-1')).toBeDefined();
    expect(screen.getByTestId('audit-log-row-log-2')).toBeDefined();
    expect(screen.getByTestId('audit-log-row-log-3')).toBeDefined();

    const select = screen.getByTestId('audit-log-filter-result');
    fireEvent.change(select, { target: { value: 'denied' } });

    expect(mockUseAuditLogList).toHaveBeenCalledWith(
      25,
      expect.objectContaining({ filterResult: 'denied' })
    );
    expect(screen.getByTestId('audit-log-row-log-3')).toBeDefined();
    expect(screen.queryByTestId('audit-log-row-log-1')).toBeNull();
    expect(screen.queryByTestId('audit-log-row-log-2')).toBeNull();
    expect(screen.getByText(/1건 표시됨 \/ 전체 1건/)).toBeDefined();
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

    mockUseAuditLogList.mockImplementation((_pageSize?: number, filters?: any) => {
      const filtered = filters?.filterResult
        ? mockEntries.filter((e) => e.result === filters.filterResult)
        : mockEntries;
      return {
        ...defaultMockReturn,
        entries: filtered,
      };
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
    expect(screen.getByText(/1건 표시됨 \/ 전체 2건/)).toBeDefined();

    // When filter matches 0 entries, empty state should appear
    fireEvent.change(input, { target: { value: 'groups' } });
    expect(screen.getByTestId('audit-log-filter-empty')).toBeDefined();
    expect(screen.getByText('필터에 매칭되는 로그가 없습니다.')).toBeDefined();
    expect(screen.getByText(/0건 표시됨 \/ 전체 2건/)).toBeDefined();
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

    mockUseAuditLogList.mockImplementation((_pageSize?: number, filters?: any) => {
      const filtered = filters?.filterResult
        ? mockEntries.filter((e) => e.result === filters.filterResult)
        : mockEntries;
      return {
        ...defaultMockReturn,
        entries: filtered,
      };
    });

    renderWithRouter(<AuditLogTable />, ['/super_admin/audit?result=denied']);

    const select = screen.getByTestId('audit-log-filter-result') as HTMLSelectElement;
    expect(select.value).toBe('denied');
    expect(mockUseAuditLogList).toHaveBeenCalledWith(
      25,
      expect.objectContaining({ filterResult: 'denied' })
    );
    expect(screen.getByTestId('audit-log-row-log-2')).toBeDefined();
    expect(screen.queryByTestId('audit-log-row-log-1')).toBeNull();
    expect(screen.getByText(/1건 표시됨 \/ 전체 1건/)).toBeDefined();
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

  it('triggers CSV download with BOM and formatted filename when export button is clicked', async () => {
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
        message: '사용자 "영구" 삭제\n확인 완료',
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
    ];

    mockUseAuditLogList.mockReturnValue({
      ...defaultMockReturn,
      entries: mockEntries,
    });

    let createdBlob: Blob | null = null;
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const mockCreateObjectURL = vi.fn((blob: Blob) => {
      createdBlob = blob;
      return 'blob:mock-url';
    });
    const mockRevokeObjectURL = vi.fn();
    URL.createObjectURL = mockCreateObjectURL;
    URL.revokeObjectURL = mockRevokeObjectURL;

    let createdAnchor: HTMLAnchorElement | null = null;
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
      const el = originalCreateElement(tagName, options);
      if (tagName === 'a') {
        createdAnchor = el as HTMLAnchorElement;
      }
      return el;
    }) as typeof document.createElement);

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    try {
      renderWithRouter(<AuditLogTable />);

      const exportButton = screen.getByTestId('audit-log-export-csv');
      expect(exportButton).toBeDefined();
      expect(exportButton.hasAttribute('disabled')).toBe(false);

      fireEvent.click(exportButton);

      expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
      expect(createdBlob).not.toBeNull();
      expect(createdAnchor).not.toBeNull();
      expect(createdAnchor?.download).toMatch(/^audit-log-\d{4}-\d{2}-\d{2}\.csv$/);
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

      if (createdBlob) {
        const buf = await (createdBlob as Blob).arrayBuffer();
        const bytes = new Uint8Array(buf);
        // Verify UTF-8 BOM: 0xEF, 0xBB, 0xBF
        expect(bytes[0]).toBe(0xEF);
        expect(bytes[1]).toBe(0xBB);
        expect(bytes[2]).toBe(0xBF);

        const text = await (createdBlob as Blob).text();
        expect(text.startsWith('"시간","행위자","역할","액션","대상","결과","요청 ID","메시지"')).toBe(true);
        // Quoted strings and replaced newlines
        expect(text).toContain('사용자 ""영구"" 삭제 확인 완료');
      }
    } finally {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      createElementSpy.mockRestore();
      clickSpy.mockRestore();
    }
  });

  it('disables CSV export button when filteredEntries is empty', () => {
    mockUseAuditLogList.mockReturnValue({
      ...defaultMockReturn,
      entries: [],
    });

    renderWithRouter(<AuditLogTable />);

    const exportButton = screen.getByTestId('audit-log-export-csv');
    expect(exportButton).toBeDefined();
    expect(exportButton.hasAttribute('disabled')).toBe(true);
  });

  // v0.108: JSON export 는 CSV 옆에 추가. 필터 metadata 와 array 로 encoded.
  it('v0.108: JSON export 는 필터 metadata + entries array 로 다운로드', async () => {
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
        message: 'multi\nline\nmessage', // JSON 은 개행 유지 (CSV 는 제거).
      },
    ];
    mockUseAuditLogList.mockReturnValue({ ...defaultMockReturn, entries: mockEntries });

    let createdBlob: Blob | null = null;
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn((blob: Blob) => {
      createdBlob = blob;
      return 'blob:mock-url';
    });
    URL.revokeObjectURL = vi.fn();

    let createdAnchor: HTMLAnchorElement | null = null;
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
        const el = originalCreateElement(tagName, options);
        if (tagName === 'a') createdAnchor = el as HTMLAnchorElement;
        return el;
      }) as typeof document.createElement);
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    try {
      // URL 에 result=error 를 주면 파일명 요약에 반영돼야.
      renderWithRouter(<AuditLogTable />, ['/super_admin/audit?result=error']);

      const btn = screen.getByTestId('audit-log-export-json');
      expect(btn).toBeDefined();
      expect(btn.hasAttribute('disabled')).toBe(false);
      fireEvent.click(btn);

      expect(createdBlob).not.toBeNull();
      expect((createdBlob as Blob).type).toContain('application/json');
      // 파일명 확장자 + 필터 요약.
      expect(createdAnchor?.download).toMatch(/^audit-log-\d{4}-\d{2}-\d{2}-result-error\.json$/);

      const text = await (createdBlob as Blob).text();
      const parsed = JSON.parse(text);
      expect(parsed.filter).toMatchObject({ result: 'error' });
      // v0.108b F53: partial/hasMore 명시.
      expect(parsed).toHaveProperty('hasMore');
      expect(parsed).toHaveProperty('partial');
      expect(parsed.count).toBe(1);
      expect(parsed.entries).toHaveLength(1);
      expect(parsed.entries[0]).toMatchObject({
        id: 'log-1',
        actor: 'super@cam.hs.kr',
        action: 'users.delete',
        result: 'ok',
        message: 'multi\nline\nmessage', // 개행 유지.
      });
      expect(parsed.entries[0].atIso).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      // v0.108b F54: before/after 필드 존재 (null 또는 값).
      expect(parsed.entries[0]).toHaveProperty('before');
      expect(parsed.entries[0]).toHaveProperty('after');
    } finally {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      createElementSpy.mockRestore();
      clickSpy.mockRestore();
    }
  });

  it('v0.108: JSON export 버튼은 empty 시 disabled', () => {
    mockUseAuditLogList.mockReturnValue({ ...defaultMockReturn, entries: [] });
    renderWithRouter(<AuditLogTable />);
    const btn = screen.getByTestId('audit-log-export-json');
    expect(btn.hasAttribute('disabled')).toBe(true);
  });

  // v0.108b F53: hasMore=true → partial=true 로 명시.
  it('v0.108b F53: hasMore=true 시 payload partial=true', async () => {
    mockUseAuditLogList.mockReturnValue({
      ...defaultMockReturn,
      entries: [
        {
          id: 'log-1',
          actor: 'super@cam.hs.kr',
          role: 'super_admin',
          action: 'users.read',
          target: '*',
          request_id: 'r1',
          result: 'ok',
          at: 1725150000000,
        } as AuditLogEntryRead,
      ],
      hasMore: true,
    });

    let capturedBlob: Blob | null = null;
    const origCreate = URL.createObjectURL;
    URL.createObjectURL = vi.fn((b: Blob) => {
      capturedBlob = b;
      return 'blob:mock-url';
    });
    URL.revokeObjectURL = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    try {
      renderWithRouter(<AuditLogTable />);
      fireEvent.click(screen.getByTestId('audit-log-export-json'));
      const text = await (capturedBlob as unknown as Blob).text();
      const parsed = JSON.parse(text);
      expect(parsed.hasMore).toBe(true);
      expect(parsed.partial).toBe(true);
    } finally {
      URL.createObjectURL = origCreate;
      clickSpy.mockRestore();
    }
  });

  // v0.108b F54: before/after 값이 있으면 export.
  it('v0.108b F54: entry.before/after 는 payload 에 보존', async () => {
    mockUseAuditLogList.mockReturnValue({
      ...defaultMockReturn,
      entries: [
        {
          id: 'log-1',
          actor: 'super@cam.hs.kr',
          role: 'super_admin',
          action: 'users.update',
          target: 'u@cam.hs.kr',
          request_id: 'r1',
          result: 'ok',
          at: 1725150000000,
          before: { role: 'teacher' },
          after: { role: 'admin' },
        } as any,
      ],
    });

    let capturedBlob: Blob | null = null;
    const origCreate = URL.createObjectURL;
    URL.createObjectURL = vi.fn((b: Blob) => {
      capturedBlob = b;
      return 'blob:mock-url';
    });
    URL.revokeObjectURL = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    try {
      renderWithRouter(<AuditLogTable />);
      fireEvent.click(screen.getByTestId('audit-log-export-json'));
      const text = await (capturedBlob as unknown as Blob).text();
      const parsed = JSON.parse(text);
      expect(parsed.entries[0].before).toEqual({ role: 'teacher' });
      expect(parsed.entries[0].after).toEqual({ role: 'admin' });
    } finally {
      URL.createObjectURL = origCreate;
      clickSpy.mockRestore();
    }
  });

  // v0.108b F55: URL 에 중복 action 이 들어오면 실제 hook 은 dedup 배열, payload metadata 도 dedup.
  it('v0.108b F55: URL 에 중복 action 있으면 payload.filter.actions 는 dedup 배열', async () => {
    mockUseAuditLogList.mockReturnValue({
      ...defaultMockReturn,
      entries: [
        {
          id: 'log-1',
          actor: 'super@cam.hs.kr',
          role: 'super_admin',
          action: 'users.read',
          target: '*',
          request_id: 'r1',
          result: 'ok',
          at: 1725150000000,
        } as AuditLogEntryRead,
      ],
    });

    let capturedBlob: Blob | null = null;
    const origCreate = URL.createObjectURL;
    URL.createObjectURL = vi.fn((b: Blob) => {
      capturedBlob = b;
      return 'blob:mock-url';
    });
    URL.revokeObjectURL = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    try {
      // URL 에 중복.
      renderWithRouter(<AuditLogTable />, [
        '/super_admin/audit?action=users.read,users.read,audit.read',
      ]);
      fireEvent.click(screen.getByTestId('audit-log-export-json'));
      const text = await (capturedBlob as unknown as Blob).text();
      const parsed = JSON.parse(text);
      // dedup 결과: 중복 users.read 제거.
      expect(parsed.filter.actions).toEqual(['users.read', 'audit.read']);
    } finally {
      URL.createObjectURL = origCreate;
      clickSpy.mockRestore();
    }
  });

  it('v0.108: CSV/JSON 파일명 요약 — action 필터 있을 때 파일명 접미어 포함', async () => {
    mockUseAuditLogList.mockReturnValue({
      ...defaultMockReturn,
      entries: [
        {
          id: 'log-a',
          actor: 'super@cam.hs.kr',
          role: 'super_admin',
          action: 'users.read',
          target: '*',
          request_id: 'req-a',
          result: 'ok',
          at: 1725150000000,
        } as AuditLogEntryRead,
      ],
    });

    const originalCreateObjectURL = URL.createObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = vi.fn();

    let anchorEl: HTMLAnchorElement | null = null;
    const originalCreateElement = document.createElement.bind(document);
    const spy = vi
      .spyOn(document, 'createElement')
      .mockImplementation(((tag: string, options?: ElementCreationOptions) => {
        const el = originalCreateElement(tag, options);
        if (tag === 'a') anchorEl = el as HTMLAnchorElement;
        return el;
      }) as typeof document.createElement);
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    try {
      renderWithRouter(<AuditLogTable />, ['/super_admin/audit?action=users.read']);
      fireEvent.click(screen.getByTestId('audit-log-export-csv'));
      expect(anchorEl?.download).toMatch(/action-users\.read\.csv$/);
    } finally {
      URL.createObjectURL = originalCreateObjectURL;
      spy.mockRestore();
      clickSpy.mockRestore();
    }
  });

  it('applies actor filter from initial URL search params (?actor=super@cam.hs.kr) and passes filterActor to hook', () => {
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

    renderWithRouter(<AuditLogTable />, ['/super_admin/audit?actor=super@cam.hs.kr']);

    const actorInput = screen.getByTestId('audit-log-filter-actor') as HTMLInputElement;
    expect(actorInput.value).toBe('super@cam.hs.kr');
    expect(mockUseAuditLogList).toHaveBeenCalledWith(
      25,
      expect.objectContaining({ filterActor: 'super@cam.hs.kr' })
    );
    expect(screen.getByTestId('audit-log-row-log-1')).toBeDefined();
  });

  it('updates URL search params when actor filter input changes', () => {
    let capturedSearch = '';
    function LocationSpy() {
      const location = useLocation();
      capturedSearch = location.search;
      return null;
    }

    render(
      <MemoryRouter initialEntries={['/super_admin/audit']}>
        <LocationSpy />
        <AuditLogTable />
      </MemoryRouter>
    );

    const input = screen.getByTestId('audit-log-filter-actor');
    fireEvent.change(input, { target: { value: 'teacher@cam.hs.kr' } });
    expect(capturedSearch).toBe('?actor=teacher%40cam.hs.kr');

    fireEvent.change(input, { target: { value: '' } });
    expect(capturedSearch).toBe('');
  });

  it('renders filter-empty message when server returns 0 entries with active filter', () => {
    mockUseAuditLogList.mockReturnValue({
      ...defaultMockReturn,
      entries: [],
    });

    renderWithRouter(<AuditLogTable />, ['/super_admin/audit?actor=unknown@cam.hs.kr']);

    expect(screen.getByTestId('audit-log-empty')).toBeDefined();
    expect(screen.getByText('해당 필터에 매칭되는 로그가 없습니다.')).toBeDefined();
  });

  it('updates URL and passes atMin timestamp to hook when atMin date input changes', () => {
    let capturedSearch = '';
    function LocationSpy() {
      const location = useLocation();
      capturedSearch = location.search;
      return null;
    }

    render(
      <MemoryRouter initialEntries={['/super_admin/audit']}>
        <LocationSpy />
        <AuditLogTable />
      </MemoryRouter>
    );

    const input = screen.getByTestId('audit-log-filter-atmin');
    fireEvent.change(input, { target: { value: '2026-09-01' } });

    expect(capturedSearch).toBe('?atMin=2026-09-01');
    const expectedAtMin = new Date('2026-09-01T00:00:00').getTime();
    expect(mockUseAuditLogList).toHaveBeenCalledWith(
      25,
      expect.objectContaining({ atMin: expectedAtMin })
    );
  });

  it('reads atMax from URL and removes URL parameter when cleared', () => {
    let capturedSearch = '';
    function LocationSpy() {
      const location = useLocation();
      capturedSearch = location.search;
      return null;
    }

    render(
      <MemoryRouter initialEntries={['/super_admin/audit?atMax=2026-09-03']}>
        <LocationSpy />
        <AuditLogTable />
      </MemoryRouter>
    );

    const input = screen.getByTestId('audit-log-filter-atmax') as HTMLInputElement;
    expect(input.value).toBe('2026-09-03');
    const expectedAtMax = new Date('2026-09-03T23:59:59.999').getTime();
    expect(mockUseAuditLogList).toHaveBeenCalledWith(
      25,
      expect.objectContaining({ atMax: expectedAtMax })
    );

    fireEvent.change(input, { target: { value: '' } });
    expect(capturedSearch).toBe('');
  });

  it('updates URL with atMin for today when "오늘" preset chip is clicked and clears atMax', () => {
    let capturedSearch = '';
    function LocationSpy() {
      const location = useLocation();
      capturedSearch = location.search;
      return null;
    }

    render(
      <MemoryRouter initialEntries={['/super_admin/audit?atMax=2026-09-03']}>
        <LocationSpy />
        <AuditLogTable />
      </MemoryRouter>
    );

    const preset0Btn = screen.getByTestId('audit-log-preset-0');
    expect(preset0Btn.textContent).toBe('오늘');
    fireEvent.click(preset0Btn);

    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const expectedDate = `${yyyy}-${mm}-${dd}`;

    expect(capturedSearch).toBe(`?atMin=${expectedDate}`);
  });

  it('updates URL with atMin when 7-day preset chip is clicked and clears atMax', () => {
    let capturedSearch = '';
    function LocationSpy() {
      const location = useLocation();
      capturedSearch = location.search;
      return null;
    }

    render(
      <MemoryRouter initialEntries={['/super_admin/audit?atMax=2026-09-03']}>
        <LocationSpy />
        <AuditLogTable />
      </MemoryRouter>
    );

    const preset7Btn = screen.getByTestId('audit-log-preset-7');
    fireEvent.click(preset7Btn);

    const d = new Date();
    d.setDate(d.getDate() - 7);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const expectedDate = `${yyyy}-${mm}-${dd}`;

    expect(capturedSearch).toBe(`?atMin=${expectedDate}`);
  });

  it('clears atMin and atMax URL parameters when all preset chip is clicked', () => {
    let capturedSearch = '';
    function LocationSpy() {
      const location = useLocation();
      capturedSearch = location.search;
      return null;
    }

    render(
      <MemoryRouter initialEntries={['/super_admin/audit?atMin=2026-09-01&atMax=2026-09-03']}>
        <LocationSpy />
        <AuditLogTable />
      </MemoryRouter>
    );

    const presetAllBtn = screen.getByTestId('audit-log-preset-all');
    fireEvent.click(presetAllBtn);

    expect(capturedSearch).toBe('');
  });

  // v0.111: role_split quick filter preset.
  it('v0.111: role_split preset 클릭 → action=system.role_split_detected,system.role_split_resolved 로 URL 갱신', () => {
    let capturedSearch = '';
    function LocationSpy() {
      const location = useLocation();
      capturedSearch = location.search;
      return null;
    }

    render(
      <MemoryRouter initialEntries={['/super_admin/audit']}>
        <LocationSpy />
        <AuditLogTable />
      </MemoryRouter>,
    );

    const btn = screen.getByTestId('audit-log-preset-role-split');
    fireEvent.click(btn);

    // URL 에 두 action 이 콤마 구분으로 설정.
    expect(capturedSearch).toContain('action=');
    expect(capturedSearch).toContain('system.role_split_detected');
    expect(capturedSearch).toContain('system.role_split_resolved');
  });

  it('v0.111: role_split preset 이미 활성일 때 재클릭 → clear', () => {
    let capturedSearch = '';
    function LocationSpy() {
      const location = useLocation();
      capturedSearch = location.search;
      return null;
    }

    render(
      <MemoryRouter
        initialEntries={[
          '/super_admin/audit?action=system.role_split_detected,system.role_split_resolved',
        ]}
      >
        <LocationSpy />
        <AuditLogTable />
      </MemoryRouter>,
    );

    const btn = screen.getByTestId('audit-log-preset-role-split');
    // 활성 상태여야.
    expect(btn.className).toContain('bg-fg-primary');
    fireEvent.click(btn);
    // action param 사라져야.
    expect(capturedSearch).not.toContain('action=');
  });

  it('v0.111: role_split preset 은 정확히 두 action 이 있을 때만 활성', () => {
    // 하나만 → 비활성.
    render(
      <MemoryRouter initialEntries={['/super_admin/audit?action=system.role_split_detected']}>
        <AuditLogTable />
      </MemoryRouter>,
    );
    const btn = screen.getByTestId('audit-log-preset-role-split');
    expect(btn.className).not.toContain('bg-fg-primary text-canvas');
  });

  // v0.111b F62: action filter 로 결과 0건일 때 empty-state 문구가 「해당 필터에 매칭 없음」
  // 이어야 (전체 부재 오도 방지).
  it('v0.111b F62: action 필터로 0건이면 empty state = 「해당 필터에 매칭되는 로그가 없습니다」', () => {
    mockUseAuditLogList.mockReturnValue({ ...defaultMockReturn, entries: [] });
    render(
      <MemoryRouter
        initialEntries={[
          '/super_admin/audit?action=system.role_split_detected,system.role_split_resolved',
        ]}
      >
        <AuditLogTable />
      </MemoryRouter>,
    );
    const empty = screen.getByTestId('audit-log-empty');
    expect(empty.textContent).toContain('해당 필터에 매칭되는 로그가 없습니다');
    expect(empty.textContent).not.toContain('감사 로그 항목이 없습니다');
  });

  it('v0.111b F62: q 검색 필터로 0건이어도 「해당 필터에 매칭 없음」', () => {
    mockUseAuditLogList.mockReturnValue({ ...defaultMockReturn, entries: [] });
    render(
      <MemoryRouter initialEntries={['/super_admin/audit?q=nonexistent']}>
        <AuditLogTable />
      </MemoryRouter>,
    );
    const empty = screen.getByTestId('audit-log-empty');
    expect(empty.textContent).toContain('해당 필터에 매칭되는 로그가 없습니다');
  });

  it('v0.111b F62: 필터 없이 0건이면 「감사 로그 항목이 없습니다」', () => {
    mockUseAuditLogList.mockReturnValue({ ...defaultMockReturn, entries: [] });
    render(
      <MemoryRouter initialEntries={['/super_admin/audit']}>
        <AuditLogTable />
      </MemoryRouter>,
    );
    const empty = screen.getByTestId('audit-log-empty');
    expect(empty.textContent).toContain('감사 로그 항목이 없습니다');
  });

  // v0.111c F64: 공백-only q 는 실제 필터 미적용이므로 empty state 도 「필터 없음」 처리.
  it('v0.111c F64: 공백-only q 0건 → 「감사 로그 항목이 없습니다」 (필터 미적용)', () => {
    mockUseAuditLogList.mockReturnValue({ ...defaultMockReturn, entries: [] });
    render(
      <MemoryRouter initialEntries={['/super_admin/audit?q=%20%20']}>
        <AuditLogTable />
      </MemoryRouter>,
    );
    const empty = screen.getByTestId('audit-log-empty');
    expect(empty.textContent).toContain('감사 로그 항목이 없습니다');
    expect(empty.textContent).not.toContain('해당 필터에 매칭되는 로그가 없습니다');
  });

  // v0.112: 「필터 초기화」 button.
  it('v0.112: 필터 없음 상태에서 「필터 초기화」 disabled', () => {
    mockUseAuditLogList.mockReturnValue({ ...defaultMockReturn });
    render(
      <MemoryRouter initialEntries={['/super_admin/audit']}>
        <AuditLogTable />
      </MemoryRouter>,
    );
    const btn = screen.getByTestId('audit-log-clear-filters') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('v0.112: 임의의 필터가 있으면 「필터 초기화」 활성', () => {
    mockUseAuditLogList.mockReturnValue({ ...defaultMockReturn });
    render(
      <MemoryRouter initialEntries={['/super_admin/audit?result=error']}>
        <AuditLogTable />
      </MemoryRouter>,
    );
    const btn = screen.getByTestId('audit-log-clear-filters') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('v0.112: 「필터 초기화」 클릭 → 모든 URL param 제거', () => {
    let capturedSearch = '';
    function LocationSpy() {
      const location = useLocation();
      capturedSearch = location.search;
      return null;
    }
    mockUseAuditLogList.mockReturnValue({ ...defaultMockReturn });
    render(
      <MemoryRouter
        initialEntries={[
          '/super_admin/audit?actor=super@cam.hs.kr&result=error&action=users.read&q=test&atMin=2026-01-01',
        ]}
      >
        <LocationSpy />
        <AuditLogTable />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId('audit-log-clear-filters'));
    expect(capturedSearch).toBe('');
  });

  it('v0.112: 공백-only q 는 「초기화」 대상 아님 (필터 미적용이므로 disabled 유지)', () => {
    mockUseAuditLogList.mockReturnValue({ ...defaultMockReturn });
    render(
      <MemoryRouter initialEntries={['/super_admin/audit?q=%20%20']}>
        <AuditLogTable />
      </MemoryRouter>,
    );
    const btn = screen.getByTestId('audit-log-clear-filters') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  // v0.114: 필터 preset 저장 UI.
  it('v0.114: preset 없을 때 「아직 없음」 + 저장 버튼', () => {
    localStorage.clear();
    mockUseAuditLogList.mockReturnValue({ ...defaultMockReturn });
    render(
      <MemoryRouter initialEntries={['/super_admin/audit']}>
        <AuditLogTable />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('audit-log-presets-empty')).toBeDefined();
    expect(screen.getByTestId('audit-log-preset-save-btn')).toBeDefined();
  });

  it('v0.114: 저장된 preset 은 chip 형태로 렌더', () => {
    localStorage.clear();
    localStorage.setItem(
      'audit_filter_presets_v1',
      JSON.stringify([{ name: '에러만', params: 'result=error' }]),
    );
    mockUseAuditLogList.mockReturnValue({ ...defaultMockReturn });
    render(
      <MemoryRouter initialEntries={['/super_admin/audit']}>
        <AuditLogTable />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('audit-log-preset-saved-에러만')).toBeDefined();
    expect(screen.getByTestId('audit-log-preset-saved-delete-에러만')).toBeDefined();
    expect(screen.queryByTestId('audit-log-presets-empty')).toBeNull();
  });

  it('v0.114: preset 클릭 → URL search 갱신', () => {
    localStorage.clear();
    localStorage.setItem(
      'audit_filter_presets_v1',
      JSON.stringify([{ name: 'test', params: 'action=users.read' }]),
    );
    let capturedSearch = '';
    function LocationSpy() {
      const location = useLocation();
      capturedSearch = location.search;
      return null;
    }
    mockUseAuditLogList.mockReturnValue({ ...defaultMockReturn });
    render(
      <MemoryRouter initialEntries={['/super_admin/audit']}>
        <LocationSpy />
        <AuditLogTable />
      </MemoryRouter>,
    );
    fireEvent.click(
      screen.getByTestId('audit-log-preset-saved-test').querySelector('button')!,
    );
    expect(capturedSearch).toBe('?action=users.read');
  });

  it('v0.114: preset 삭제 → localStorage 에서 제거', () => {
    localStorage.clear();
    localStorage.setItem(
      'audit_filter_presets_v1',
      JSON.stringify([
        { name: 'a', params: 'q=1' },
        { name: 'b', params: 'q=2' },
      ]),
    );
    mockUseAuditLogList.mockReturnValue({ ...defaultMockReturn });
    render(
      <MemoryRouter initialEntries={['/super_admin/audit']}>
        <AuditLogTable />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId('audit-log-preset-saved-delete-a'));
    expect(screen.queryByTestId('audit-log-preset-saved-a')).toBeNull();
    expect(screen.getByTestId('audit-log-preset-saved-b')).toBeDefined();
    const stored = JSON.parse(localStorage.getItem('audit_filter_presets_v1') ?? '[]');
    expect(stored).toEqual([{ name: 'b', params: 'q=2' }]);
  });

  it('v0.114: 「현재 필터 저장」 → prompt → localStorage 저장', () => {
    localStorage.clear();
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('내 필터');
    mockUseAuditLogList.mockReturnValue({ ...defaultMockReturn });
    render(
      <MemoryRouter initialEntries={['/super_admin/audit?result=error']}>
        <AuditLogTable />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId('audit-log-preset-save-btn'));
    expect(promptSpy).toHaveBeenCalled();
    expect(screen.getByTestId('audit-log-preset-saved-내 필터')).toBeDefined();
    const stored = JSON.parse(localStorage.getItem('audit_filter_presets_v1') ?? '[]');
    expect(stored).toEqual([{ name: '내 필터', params: 'result=error' }]);
    promptSpy.mockRestore();
  });

  it('v0.114: prompt cancel (null) → 저장 안 함', () => {
    localStorage.clear();
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue(null);
    mockUseAuditLogList.mockReturnValue({ ...defaultMockReturn });
    render(
      <MemoryRouter initialEntries={['/super_admin/audit?result=error']}>
        <AuditLogTable />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId('audit-log-preset-save-btn'));
    expect(localStorage.getItem('audit_filter_presets_v1')).toBeNull();
    expect(screen.queryByTestId('audit-log-preset-error')).toBeNull();
    promptSpy.mockRestore();
  });

  it('v0.114: 빈 이름 → error 표시 · 저장 안 함', () => {
    localStorage.clear();
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('   ');
    mockUseAuditLogList.mockReturnValue({ ...defaultMockReturn });
    render(
      <MemoryRouter initialEntries={['/super_admin/audit']}>
        <AuditLogTable />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId('audit-log-preset-save-btn'));
    expect(screen.getByTestId('audit-log-preset-error').textContent).toContain(
      '이름을 입력',
    );
    expect(localStorage.getItem('audit_filter_presets_v1')).toBeNull();
    promptSpy.mockRestore();
  });

  // v0.114b F69: setItem throws (quota/security) → 저장소 오류 문구 · chip 렌더 안 함.
  it('v0.114b F69: storage_error → error 문구 표시, chip 렌더 안 함', () => {
    localStorage.clear();
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('new');
    const setItemSpy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('quota exceeded');
      });
    mockUseAuditLogList.mockReturnValue({ ...defaultMockReturn });
    render(
      <MemoryRouter initialEntries={['/super_admin/audit']}>
        <AuditLogTable />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId('audit-log-preset-save-btn'));
    expect(screen.getByTestId('audit-log-preset-error').textContent).toContain(
      '브라우저 저장소',
    );
    expect(screen.queryByTestId('audit-log-preset-saved-new')).toBeNull();
    promptSpy.mockRestore();
    setItemSpy.mockRestore();
  });

  // v0.111b F63: aria-pressed 접근성.
  it('v0.111b F63: role_split preset 비활성 상태 aria-pressed=false', () => {
    render(
      <MemoryRouter initialEntries={['/super_admin/audit']}>
        <AuditLogTable />
      </MemoryRouter>,
    );
    const btn = screen.getByTestId('audit-log-preset-role-split');
    expect(btn.getAttribute('aria-pressed')).toBe('false');
  });

  it('v0.111b F63: role_split preset 활성 상태 aria-pressed=true', () => {
    render(
      <MemoryRouter
        initialEntries={[
          '/super_admin/audit?action=system.role_split_detected,system.role_split_resolved',
        ]}
      >
        <AuditLogTable />
      </MemoryRouter>,
    );
    const btn = screen.getByTestId('audit-log-preset-role-split');
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('v0.111b F63: extra action 있으면 aria-pressed=false', () => {
    render(
      <MemoryRouter
        initialEntries={[
          '/super_admin/audit?action=system.role_split_detected,system.role_split_resolved,users.read',
        ]}
      >
        <AuditLogTable />
      </MemoryRouter>,
    );
    const btn = screen.getByTestId('audit-log-preset-role-split');
    expect(btn.getAttribute('aria-pressed')).toBe('false');
  });

  it('renders actor as a link to user detail when actor ends with @cam.hs.kr, and plain text for non-domain actor', () => {
    const mockEntries: AuditLogEntryRead[] = [
      {
        id: 'log-1',
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'users.update',
        target: 'teacher@cam.hs.kr',
        request_id: 'req-1',
        result: 'ok',
        at: 1725150000000,
      },
      {
        id: 'log-2',
        actor: 'unknown',
        role: 'admin',
        action: 'system.cleanup',
        target: '*',
        request_id: 'req-2',
        result: 'ok',
        at: 1725140000000,
      },
    ];

    mockUseAuditLogList.mockReturnValue({
      ...defaultMockReturn,
      entries: mockEntries,
    });

    renderWithRouter(<AuditLogTable />);

    const link = screen.getByTestId('audit-actor-link-admin@cam.hs.kr');
    expect(link).toBeDefined();
    expect(link.getAttribute('href')).toBe('/admin/users/admin%40cam.hs.kr');
    expect(link.textContent).toBe('admin@cam.hs.kr');

    expect(screen.queryByTestId('audit-actor-link-unknown')).toBeNull();
    expect(screen.getByText('unknown')).toBeDefined();
  });

  // v0.101 (v0.104 갱신): filterAction 단일 값 URL 은 이전과 호환.
  it('v0.101/v0.104: single action URL sets filterAction (backward-compat single)', () => {
    mockUseAuditLogList.mockReturnValue({ ...defaultMockReturn });

    renderWithRouter(<AuditLogTable />, ['/super_admin/audit?action=users.update_role']);

    const summary = screen.getByTestId('audit-log-filter-action-multi').querySelector('summary');
    expect(summary).not.toBeNull();
    expect(summary!.textContent).toContain('users.update_role');

    // hook 은 filterAction (단일) 로 전달.
    const lastCall = mockUseAuditLogList.mock.calls.at(-1);
    expect(lastCall?.[1]).toMatchObject({ filterAction: 'users.update_role' });
    expect(lastCall?.[1].filterActions).toBeUndefined();
  });

  // v0.104: 콤마 구분 다중 액션 URL → filterActions 배열 · summary 는 "N개 선택됨".
  it('v0.104: comma-separated action URL forwards filterActions to hook', () => {
    mockUseAuditLogList.mockReturnValue({ ...defaultMockReturn });

    renderWithRouter(<AuditLogTable />, [
      '/super_admin/audit?action=users.update_role,users.read,audit.read',
    ]);

    const summary = screen.getByTestId('audit-log-filter-action-multi').querySelector('summary');
    expect(summary!.textContent).toContain('3개');

    const lastCall = mockUseAuditLogList.mock.calls.at(-1);
    expect(lastCall?.[1]).toMatchObject({
      filterActions: ['users.update_role', 'users.read', 'audit.read'],
    });
    // 단일이 아니므로 filterAction 은 undefined.
    expect(lastCall?.[1].filterAction).toBeUndefined();
  });

  // v0.104: 체크박스 토글 시 URL 이 콤마 구분으로 갱신.
  it('v0.104: toggling a checkbox updates URL action param (comma joined)', () => {
    mockUseAuditLogList.mockReturnValue({ ...defaultMockReturn });

    renderWithRouter(<AuditLogTable />, ['/super_admin/audit?action=users.read']);

    // users.update_role 체크박스 토글.
    const cb = screen.getByTestId('audit-log-filter-action-cb-users.update_role') as HTMLInputElement;
    expect(cb.checked).toBe(false);
    fireEvent.click(cb);

    // 리렌더 후 훅 인자 확인.
    const lastCall = mockUseAuditLogList.mock.calls.at(-1);
    expect(lastCall?.[1]).toMatchObject({
      filterActions: ['users.read', 'users.update_role'],
    });
  });

  // v0.104b F40: WAI-ARIA — checkbox 컨테이너는 role=listbox 가 아닌 role=group.
  it('v0.104b F40: action multi popover 컨테이너는 role=group (aria-multiselectable 없음)', () => {
    mockUseAuditLogList.mockReturnValue({ ...defaultMockReturn });

    renderWithRouter(<AuditLogTable />);

    const groupEl = screen.getByRole('group', { name: /액션 다중 선택/ });
    expect(groupEl).toBeDefined();
    expect(groupEl.getAttribute('role')).toBe('group');
    // listbox 로 오인식되지 않아야.
    expect(groupEl.getAttribute('aria-multiselectable')).toBeNull();
    // listbox 는 존재하면 안 됨.
    expect(screen.queryByRole('listbox', { name: /액션 다중 선택/ })).toBeNull();
  });

  // v0.104: 전체 해제 버튼 → URL action 파라미터 삭제.
  it('v0.104: clear-all button removes action param', () => {
    mockUseAuditLogList.mockReturnValue({ ...defaultMockReturn });

    renderWithRouter(<AuditLogTable />, [
      '/super_admin/audit?action=users.read,users.update_role',
    ]);

    const clearBtn = screen.getByTestId('audit-log-filter-action-clear');
    fireEvent.click(clearBtn);

    const lastCall = mockUseAuditLogList.mock.calls.at(-1);
    expect(lastCall?.[1].filterAction).toBeUndefined();
    expect(lastCall?.[1].filterActions).toBeUndefined();
  });

  // v0.101: 메시지 substring 검색이 message 필드도 매치하는지 (role_split 등 탐색).
  it('v0.101: message substring filter (q) matches both action and message fields', () => {
    const entries: AuditLogEntryRead[] = [
      {
        id: 'log-split',
        actor: 'super@cam.hs.kr',
        role: 'super_admin',
        action: 'users.read',
        target: 'users/uid-1',
        request_id: 'req-s',
        result: 'error',
        at: 1725150000000,
        message: 'role_split: auth=admin firestore=teacher',
      },
      {
        id: 'log-other',
        actor: 'super@cam.hs.kr',
        role: 'super_admin',
        action: 'users.read',
        target: '*',
        request_id: 'req-o',
        result: 'ok',
        at: 1725149000000,
        message: 'listed 10 users',
      },
    ];
    mockUseAuditLogList.mockReturnValue({ ...defaultMockReturn, entries });

    renderWithRouter(<AuditLogTable />, ['/super_admin/audit?q=role_split']);

    expect(screen.getByTestId('audit-log-row-log-split')).toBeDefined();
    expect(screen.queryByTestId('audit-log-row-log-other')).toBeNull();
  });
});

