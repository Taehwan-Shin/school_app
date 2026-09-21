import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from '../src/components/ui/table';

// v0.208: sticky top header 회귀. TableHeader 에 sticky/top-0/z-10 class 부여.
describe('Table sticky header (v0.208)', () => {
  it('TableHeader 는 sticky top-0 z-10 class 포함', () => {
    const { container } = render(
      <Table>
        <TableHeader data-testid="head">
          <TableRow>
            <TableHead>H</TableHead>
          </TableRow>
        </TableHeader>
      </Table>,
    );
    const thead = container.querySelector('thead');
    expect(thead).not.toBeNull();
    expect(thead!.className).toContain('sticky');
    expect(thead!.className).toContain('top-0');
    expect(thead!.className).toContain('z-10');
    expect(thead!.className).toContain('bg-surface');
  });

  it('Table wrapper 는 overflow-x-auto (세로는 페이지 스크롤 위임)', () => {
    const { container } = render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>H</TableHead>
          </TableRow>
        </TableHeader>
      </Table>,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('overflow-x-auto');
    expect(wrapper.className).not.toContain('overflow-auto');
  });

  // v0.210: sticky 시각 강조. border-b-2 + shadow-sm 로 헤더/본문 경계 강조.
  it('v0.210: TableHeader 는 border-b-2 · shadow-sm class 포함 (sticky 시각 강조)', () => {
    const { container } = render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>H</TableHead>
          </TableRow>
        </TableHeader>
      </Table>,
    );
    const thead = container.querySelector('thead');
    expect(thead).not.toBeNull();
    expect(thead!.className).toContain('border-b-2');
    expect(thead!.className).toContain('border-border-subtle');
    expect(thead!.className).toContain('shadow-sm');
  });

  // v0.211: TableRow hover 색상을 bg-surface (thead 와 동일) 에서 fg-primary/[0.04] 로 분리.
  it('v0.211: TableRow 는 hover:bg-fg-primary/[0.04] class 포함 (sticky thead 와 hover 분리)', () => {
    const { container } = render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>H</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow data-testid="body-row">
            <TableCell>C</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    const rows = container.querySelectorAll('tr');
    // header row + body row = 2 개. 두 번째가 body row.
    expect(rows.length).toBe(2);
    const bodyRow = rows[1];
    expect(bodyRow.className).toContain('hover:bg-fg-primary/[0.04]');
    expect(bodyRow.className).not.toContain('hover:bg-surface');
  });

  // v0.213: TableBody `striped` opt-in prop → 짝수 row zebra striping.
  it('v0.213: TableBody 기본 (striped=false) → 얼룩 class 없음', () => {
    const { container } = render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>A</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    const tbody = container.querySelector('tbody');
    expect(tbody).not.toBeNull();
    expect(tbody!.className).toContain('[&_tr:last-child]:border-0');
    expect(tbody!.className).not.toContain('nth-child(even)');
  });

  it('v0.213: TableBody striped → 짝수 row 얼룩 class 포함', () => {
    const { container } = render(
      <Table>
        <TableBody striped>
          <TableRow>
            <TableCell>A</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    const tbody = container.querySelector('tbody');
    expect(tbody).not.toBeNull();
    expect(tbody!.className).toContain('[&_tr:nth-child(even)]:bg-fg-primary/[0.02]');
  });

  // v0.215: Table 컴포넌트에 aria-label pass-through (스크린 리더 컨텍스트).
  it('v0.215: <Table aria-label="X"> 는 <table> 에 aria-label 전달', () => {
    const { container } = render(
      <Table aria-label="테스트 목록">
        <TableBody>
          <TableRow>
            <TableCell>A</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    const table = container.querySelector('table');
    expect(table).not.toBeNull();
    expect(table!.getAttribute('aria-label')).toBe('테스트 목록');
  });
});
