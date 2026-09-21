import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Table, TableHeader, TableRow, TableHead } from '../src/components/ui/table';

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
});
