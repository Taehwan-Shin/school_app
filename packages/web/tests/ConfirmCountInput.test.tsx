import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmCountInput } from '../src/components/ConfirmCountInput';

describe('ConfirmCountInput (v0.253)', () => {
  it('label 이 대상 개수를 <strong> 으로 표시', () => {
    render(
      <ConfirmCountInput
        expectedCount={7}
        value=""
        onChange={() => {}}
        idPrefix="test-a"
      />,
    );
    const label = screen.getByText(/확인을 위해 대상 개수/);
    expect(label.textContent).toContain('7');
    expect(label.querySelector('strong')?.textContent).toBe('7');
  });

  it('id/testId 가 idPrefix-confirm-input 규약', () => {
    render(
      <ConfirmCountInput
        expectedCount={3}
        value=""
        onChange={() => {}}
        idPrefix="bulk-delete"
      />,
    );
    const input = screen.getByTestId('bulk-delete-confirm-input');
    expect(input.id).toBe('bulk-delete-confirm-input');
  });

  it('htmlFor 로 label ↔ input 프로그램적 연결 (getByLabelText)', () => {
    render(
      <ConfirmCountInput
        expectedCount={5}
        value=""
        onChange={() => {}}
        idPrefix="bulk-suspend"
      />,
    );
    const input = screen.getByLabelText(/확인을 위해 대상 개수/);
    expect(input.tagName).toBe('INPUT');
    expect(input.id).toBe('bulk-suspend-confirm-input');
  });

  it('사용자 입력 시 onChange 호출', () => {
    const onChange = vi.fn();
    render(
      <ConfirmCountInput
        expectedCount={4}
        value=""
        onChange={onChange}
        idPrefix="test-c"
      />,
    );
    const input = screen.getByTestId('test-c-confirm-input');
    fireEvent.change(input, { target: { value: '4' } });
    expect(onChange).toHaveBeenCalledWith('4');
  });

  it('value prop 이 input value 로 반영', () => {
    render(
      <ConfirmCountInput
        expectedCount={2}
        value="hello"
        onChange={() => {}}
        idPrefix="test-d"
      />,
    );
    const input = screen.getByTestId('test-d-confirm-input') as HTMLInputElement;
    expect(input.value).toBe('hello');
  });

  it('disabled prop 지원', () => {
    render(
      <ConfirmCountInput
        expectedCount={1}
        value=""
        onChange={() => {}}
        idPrefix="test-e"
        disabled
      />,
    );
    const input = screen.getByTestId('test-e-confirm-input') as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });
});
