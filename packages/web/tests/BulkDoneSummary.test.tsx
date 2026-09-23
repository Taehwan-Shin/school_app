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

  // v0.268: 3-category (skipped) 지원.
  it('skippedCount > 0 → 성공 뒤에 「· N{unit} {skippedSuffix}」 노출 (warning 기본)', () => {
    const { container } = render(
      <BulkDoneSummary
        successCount={5}
        failureCount={0}
        unit="개"
        skippedCount={2}
        skippedSuffix="이미 멤버 (skip)"
      />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('5개 성공');
    expect(text).toContain('2개 이미 멤버 (skip)');
    expect(text).not.toContain('실패');
    const strongs = container.querySelectorAll('strong');
    expect(strongs.length).toBe(2);
    expect(strongs[1].className).toContain('text-state-warning');
  });

  it('skippedCount + failureCount 모두 > 0 → 성공·skipped·실패 3중', () => {
    const { container } = render(
      <BulkDoneSummary
        successCount={4}
        failureCount={1}
        unit="명"
        skippedCount={3}
        skippedSuffix="이미 초대됨"
      />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('4명 성공');
    expect(text).toContain('3명 이미 초대됨');
    expect(text).toContain('1명 실패');
    const strongs = container.querySelectorAll('strong');
    expect(strongs.length).toBe(3);
    expect(strongs[0].className).toContain('text-state-success');
    expect(strongs[1].className).toContain('text-state-warning');
    expect(strongs[2].className).toContain('text-state-danger');
  });

  it('skippedCount=0 → skipped 부분 미노출', () => {
    const { container } = render(
      <BulkDoneSummary
        successCount={2}
        failureCount={0}
        unit="개"
        skippedCount={0}
        skippedSuffix="skip"
      />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('2개 성공');
    expect(text).not.toContain('skip');
    const strongs = container.querySelectorAll('strong');
    expect(strongs.length).toBe(1);
  });

  it('skippedSuffix 생략 시 "skip" default', () => {
    const { container } = render(
      <BulkDoneSummary successCount={1} failureCount={0} unit="개" skippedCount={4} />,
    );
    expect(container.textContent).toContain('4개 skip');
  });

  it('skippedVariant="danger" → text-state-danger 적용', () => {
    const { container } = render(
      <BulkDoneSummary
        successCount={1}
        failureCount={0}
        unit="개"
        skippedCount={2}
        skippedSuffix="차단"
        skippedVariant="danger"
      />,
    );
    const strongs = container.querySelectorAll('strong');
    expect(strongs[1].className).toContain('text-state-danger');
  });

  // v0.269: successSuffix / failureSuffix 커스텀.
  it('successSuffix 커스텀 (예: "생성") · "성공" 미노출', () => {
    const { container } = render(
      <BulkDoneSummary
        successCount={5}
        failureCount={0}
        unit="개"
        successSuffix="생성"
      />,
    );
    expect(container.textContent).toContain('5개 생성');
    expect(container.textContent).not.toContain('성공');
  });

  it('failureSuffix 커스텀 · "실패" 미노출', () => {
    const { container } = render(
      <BulkDoneSummary
        successCount={2}
        failureCount={3}
        unit="명"
        failureSuffix="차단됨"
      />,
    );
    expect(container.textContent).toContain('3명 차단됨');
    expect(container.textContent).not.toContain('실패');
  });
});
