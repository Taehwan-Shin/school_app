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

describe('Topbar (v0.103)', () => {
  // v0.102 F27 회귀 유지: 긴 이메일/그룹 이름 페이지 제목이 컨트롤을 밀지 않아야.
  it('long pageTitle truncates with flex-1 min-w-0 truncate + title tooltip', () => {
    const longTitle =
      '2026학년도 매우 긴 사용자 이메일 alice.superadmin@some-long-domain.example.co.kr 상세';

    render(<Topbar pageTitle={longTitle} />);

    const h1 = screen.getByText(longTitle);
    expect(h1.className).toContain('truncate');
    expect(h1.className).toContain('min-w-0');
    expect(h1.className).toContain('flex-1');
    expect(h1.getAttribute('title')).toBe(longTitle);
  });

  // v0.103 로그아웃 버튼: LogOut 아이콘 병기 (aria-hidden) + 텍스트 라벨.
  it('logout button renders LogOut icon (aria-hidden) with text label', () => {
    render(<Topbar pageTitle="테스트" />);

    const button = screen.getByRole('button', { name: '로그아웃' });
    expect(button).toBeDefined();

    // 아이콘은 button 내부 SVG · aria-hidden true 여야 스크린리더가 무시.
    const svg = button.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('aria-hidden')).toBe('true');
  });
});
