import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Banner } from '../src/components/Banner';

describe('Banner (v0.228)', () => {
  it('message=null → 미렌더', () => {
    const { container } = render(<Banner variant="success" message={null} testId="b" />);
    expect(container.firstChild).toBeNull();
  });

  it('success: role=status · aria-live=polite · state-success class', () => {
    render(<Banner variant="success" message="OK" testId="b-success" />);
    const el = screen.getByTestId('b-success');
    expect(el.getAttribute('role')).toBe('status');
    expect(el.getAttribute('aria-live')).toBe('polite');
    expect(el.className).toContain('border-state-success');
    expect(el.className).toContain('text-state-success');
    expect(el.textContent).toBe('OK');
  });

  it('error: role=alert · aria-live=assertive · state-danger class', () => {
    render(<Banner variant="error" message="실패" testId="b-error" />);
    const el = screen.getByTestId('b-error');
    expect(el.getAttribute('role')).toBe('alert');
    expect(el.getAttribute('aria-live')).toBe('assertive');
    expect(el.className).toContain('border-state-danger');
    expect(el.className).toContain('text-state-danger');
    expect(el.textContent).toBe('실패');
  });

  it('warning: role=alert · aria-live=assertive · state-warning class', () => {
    render(<Banner variant="warning" message="주의" testId="b-warning" />);
    const el = screen.getByTestId('b-warning');
    expect(el.getAttribute('role')).toBe('alert');
    expect(el.getAttribute('aria-live')).toBe('assertive');
    expect(el.className).toContain('border-state-warning');
    expect(el.className).toContain('text-state-warning');
    expect(el.textContent).toBe('주의');
  });

  it('React node message 지원 (span/strong 등)', () => {
    render(
      <Banner
        variant="error"
        message={<span data-testid="inner">복잡한 <strong>내용</strong></span>}
        testId="b-node"
      />,
    );
    expect(screen.getByTestId('inner')).toBeDefined();
  });
});
