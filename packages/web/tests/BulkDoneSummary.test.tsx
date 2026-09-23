import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BulkDoneSummary } from '../src/components/BulkDoneSummary';

describe('BulkDoneSummary (v0.264)', () => {
  it('기본 label 「완료:」 + 성공만 (failureCount=0)', () => {
    const { container } = render(
      <BulkDoneSummary successCount={5} failureCount={0} unit="명" />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('완료:');
    expect(text).toContain('5');
    expect(text).toContain('명 성공');
    expect(text).not.toContain('실패');
  });

  it('실패 있으면 「· M{unit} 실패」 노출', () => {
    const { container } = render(
      <BulkDoneSummary successCount={3} failureCount={2} unit="명" />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('3');
    expect(text).toContain('명 성공');
    expect(text).toContain('·');
    expect(text).toContain('2');
    expect(text).toContain('명 실패');
  });

  it('success 카운트는 text-state-success + font-mono', () => {
    const { container } = render(
      <BulkDoneSummary successCount={7} failureCount={0} unit="개" />,
    );
    const strong = container.querySelector('strong');
    expect(strong?.className).toContain('text-state-success');
    expect(strong?.className).toContain('font-mono');
    expect(strong?.textContent).toBe('7');
  });

  it('failure 카운트는 text-state-danger + font-mono', () => {
    const { container } = render(
      <BulkDoneSummary successCount={3} failureCount={4} unit="개" />,
    );
    const strongs = container.querySelectorAll('strong');
    expect(strongs.length).toBe(2);
    expect(strongs[1].className).toContain('text-state-danger');
    expect(strongs[1].className).toContain('font-mono');
    expect(strongs[1].textContent).toBe('4');
  });

  it('unit prop 반영 (「개」)', () => {
    const { container } = render(
      <BulkDoneSummary successCount={2} failureCount={1} unit="개" />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('개 성공');
    expect(text).toContain('개 실패');
    expect(text).not.toContain('명');
  });

  it('label prop 커스텀 (문자열)', () => {
    render(
      <BulkDoneSummary
        successCount={4}
        failureCount={0}
        unit="명"
        label="「admin」 로 변경 완료:"
      />,
    );
    expect(screen.getByText(/「admin」 로 변경 완료/)).toBeDefined();
  });

  it('label prop 은 ReactNode (JSX) 지원', () => {
    render(
      <BulkDoneSummary
        successCount={1}
        failureCount={0}
        unit="개"
        label={<span data-testid="bds-label">custom</span>}
      />,
    );
    expect(screen.getByTestId('bds-label').textContent).toBe('custom');
  });
});
