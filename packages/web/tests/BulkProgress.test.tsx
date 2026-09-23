import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BulkProgress } from '../src/components/BulkProgress';

describe('BulkProgress (v0.256)', () => {
  it('기본 label 「진행 중:」 + 카운트 표기', () => {
    render(<BulkProgress progress={3} total={7} testId="bp-a" />);
    const box = screen.getByTestId('bp-a');
    expect(box.textContent).toContain('진행 중:');
    expect(box.textContent).toContain('3');
    expect(box.textContent).toContain('7');
  });

  it('progress/total 이 font-mono <strong> 로 표기', () => {
    render(<BulkProgress progress={5} total={10} testId="bp-b" />);
    const strongs = screen.getByTestId('bp-b').querySelectorAll('strong');
    expect(strongs.length).toBe(2);
    expect(strongs[0].className).toContain('font-mono');
    expect(strongs[0].textContent).toBe('5');
    expect(strongs[1].textContent).toBe('10');
  });

  it('진행 막대 width 는 progress/total * 100 %', () => {
    render(<BulkProgress progress={2} total={8} testId="bp-c" />);
    const bar = screen.getByTestId('bp-c').querySelector('.bg-fg-primary') as HTMLElement;
    expect(bar.style.width).toBe('25%');
  });

  it('total=0 일 때 안전 (width 0%)', () => {
    render(<BulkProgress progress={0} total={0} testId="bp-zero" />);
    const bar = screen.getByTestId('bp-zero').querySelector('.bg-fg-primary') as HTMLElement;
    expect(bar.style.width).toBe('0%');
  });

  it('label prop 으로 문구 override', () => {
    render(
      <BulkProgress
        progress={1}
        total={4}
        testId="bp-label"
        label="진행 중 (「Alice」 로 이관):"
      />,
    );
    expect(screen.getByTestId('bp-label').textContent).toContain('「Alice」 로 이관');
  });

  it('label 은 ReactNode (JSX) 지원', () => {
    render(
      <BulkProgress
        progress={2}
        total={4}
        testId="bp-jsx"
        label={<span data-testid="bp-jsx-inner">custom</span>}
      />,
    );
    expect(screen.getByTestId('bp-jsx-inner').textContent).toBe('custom');
  });
});
