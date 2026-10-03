import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OrgUnitSelect } from '../src/components/OrgUnitSelect';

describe('OrgUnitSelect (v0.327)', () => {
  const ous = [{ orgUnitPath: '/학생', name: '학생' }, { orgUnitPath: '/교사' }];

  it('목록에 있는 value 는 선택 표시 · 없으면 placeholder', () => {
    const { rerender } = render(<OrgUnitSelect value="/교사" onChange={vi.fn()} orgUnits={ous} testId="s" />);
    expect((screen.getByTestId('s') as HTMLSelectElement).value).toBe('/교사');
    rerender(<OrgUnitSelect value="/없는경로" onChange={vi.fn()} orgUnits={ous} testId="s" />);
    expect((screen.getByTestId('s') as HTMLSelectElement).value).toBe('');
  });

  it('선택 → onChange(path) · placeholder 선택은 무시', () => {
    const onChange = vi.fn();
    render(<OrgUnitSelect value="" onChange={onChange} orgUnits={ous} testId="s" />);
    fireEvent.change(screen.getByTestId('s'), { target: { value: '/학생' } });
    expect(onChange).toHaveBeenCalledWith('/학생');
    fireEvent.change(screen.getByTestId('s'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('빈 목록 → 비활성 + 「직접 입력」 안내', () => {
    render(<OrgUnitSelect value="" onChange={vi.fn()} orgUnits={[]} testId="s" />);
    const el = screen.getByTestId('s') as HTMLSelectElement;
    expect(el.disabled).toBe(true);
    expect(el.textContent).toContain('직접 입력');
  });
});
