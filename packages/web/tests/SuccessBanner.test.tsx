import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SuccessBanner } from '../src/components/SuccessBanner';

describe('SuccessBanner (v0.227)', () => {
  it('message=null → 미렌더', () => {
    const { container } = render(<SuccessBanner message={null} testId="test-banner" />);
    expect(container.firstChild).toBeNull();
  });

  it('message 있으면 렌더 · testId · role="status" · aria-live="polite"', () => {
    render(<SuccessBanner message="완료됨" testId="my-banner" />);
    const el = screen.getByTestId('my-banner');
    expect(el).toBeDefined();
    expect(el.textContent).toBe('완료됨');
    expect(el.getAttribute('role')).toBe('status');
    expect(el.getAttribute('aria-live')).toBe('polite');
  });

  it('successful styling classes 포함', () => {
    render(<SuccessBanner message="OK" testId="cls-banner" />);
    const el = screen.getByTestId('cls-banner');
    expect(el.className).toContain('border-state-success');
    expect(el.className).toContain('text-state-success');
  });
});
