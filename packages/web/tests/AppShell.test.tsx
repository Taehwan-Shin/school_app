import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from '../src/components/shell/AppShell';

const mockSignOut = vi.fn();
const mockUseAuth = vi.fn();

vi.mock('../src/lib/auth', () => ({
  useAuth: () => mockUseAuth(),
  signOut: () => mockSignOut(),
}));

vi.mock('../src/lib/theme', () => ({
  useTheme: () => ({
    theme: 'light',
    toggleTheme: vi.fn(),
    setTheme: vi.fn(),
  }),
}));

describe('AppShell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { email: 'admin@cam.hs.kr' },
      role: 'admin',
      loading: false,
    });
  });

  it('renders pageTitle and child content', () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AppShell role="admin" pageTitle="관리자 대시보드">
          <div data-testid="test-content">메인 컨텐츠 영역</div>
        </AppShell>
      </MemoryRouter>,
    );

    expect(screen.getByText('관리자 대시보드')).toBeDefined();
    expect(screen.getByTestId('test-content')).toBeDefined();
    expect(screen.getByText('학교')).toBeDefined();
  });

  it('renders super_admin navigation items correctly', () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'super@cam.hs.kr' },
      role: 'super_admin',
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/super_admin']}>
        <AppShell role="super_admin" pageTitle="슈퍼 관리자">
          <div>내용</div>
        </AppShell>
      </MemoryRouter>,
    );

    expect(screen.getByText('대시보드')).toBeDefined();
    expect(screen.getByText('계정')).toBeDefined();
    expect(screen.getByText('그룹')).toBeDefined();
    expect(screen.getByText('챗방')).toBeDefined();
    expect(screen.getByText('클래스룸')).toBeDefined();
    expect(screen.getByText('감사 로그')).toBeDefined();
    expect(screen.getByText('시스템 설정')).toBeDefined();
  });

  it('renders admin navigation items correctly', () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'admin@cam.hs.kr' },
      role: 'admin',
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AppShell role="admin" pageTitle="관리자">
          <div>내용</div>
        </AppShell>
      </MemoryRouter>,
    );

    expect(screen.getByText('대시보드')).toBeDefined();
    expect(screen.getByText('계정')).toBeDefined();
    expect(screen.getByText('그룹')).toBeDefined();
    expect(screen.getByText('챗방')).toBeDefined();
    expect(screen.getByText('클래스룸')).toBeDefined();

    expect(screen.queryByText('감사 로그')).toBeNull();
    expect(screen.queryByText('시스템 설정')).toBeNull();
  });

  it('renders teacher navigation items correctly', () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'teacher@cam.hs.kr' },
      role: 'teacher',
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/teacher']}>
        <AppShell role="teacher" pageTitle="교사">
          <div>내용</div>
        </AppShell>
      </MemoryRouter>,
    );

    expect(screen.getByText('대시보드')).toBeDefined();
    expect(screen.getByText('내 클래스룸')).toBeDefined();

    expect(screen.queryByText('계정')).toBeNull();
    expect(screen.queryByText('감사 로그')).toBeNull();
    expect(screen.queryByText('시스템 설정')).toBeNull();
  });

  it('calls signOut when logout button is clicked in Topbar', () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AppShell role="admin" pageTitle="관리자">
          <div>내용</div>
        </AppShell>
      </MemoryRouter>,
    );

    const logoutBtn = screen.getByRole('button', { name: '로그아웃' });
    fireEvent.click(logoutBtn);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});
