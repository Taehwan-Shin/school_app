import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Topbar } from '../src/components/shell/Topbar';

vi.mock('../src/lib/auth', () => ({
  signOut: vi.fn(),
}));

vi.mock('../src/lib/theme', () => ({
  useTheme: () => ({ theme: 'light', toggleTheme: vi.fn(), setTheme: vi.fn() }),
}));

describe('Topbar responsive & overflow (v0.102b F27)', () => {
  it('renders long pageTitle with truncate + title tooltip and does not overflow flex controls', () => {
    const longTitle =
      '2026학년도 매우매우 길고 긴 사용자 이메일 alice.superadmin@some-long-domain.example.co.kr 상세';

    render(<Topbar pageTitle={longTitle} />);

    const h1 = screen.getByText(longTitle);
    // truncate + min-w-0 + flex-1 클래스가 존재해야 overflow 방지.
    expect(h1.className).toContain('truncate');
    expect(h1.className).toContain('min-w-0');
    expect(h1.className).toContain('flex-1');
    // 원본 텍스트를 title 로 노출 (tooltip 접근성).
    expect(h1.getAttribute('title')).toBe(longTitle);
  });

  it('hover 배경 dark 모드에서 highlighter-yellow 저대비 회피 — dark:hover:bg-elevated 명시', () => {
    render(<Topbar pageTitle="테스트" />);
    const button = screen.getByRole('button', { name: '로그아웃' });
    expect(button.className).toContain('hover:bg-highlighter-yellow');
    expect(button.className).toContain('dark:hover:bg-elevated');
    expect(button.className).toContain('hover:text-forest-ink');
  });
});
