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

    // 감사 로그 항목은 active link (<a>) 로 렌더되어야 한다.
    // v0.103: 라벨은 <a> > <span> 구조로 wrap 됨 (아이콘 병기 위해). closest('a') 로 링크 확인.
    const auditLogLink = screen.getByText('감사 로그').closest('a');
    expect(auditLogLink).not.toBeNull();
    expect(auditLogLink!.getAttribute('href')).toBe('/super_admin/audit');

    // v0.103: 라벨은 <a> > <span> 구조로 wrap 됨. closest('a') 로 링크 확인.
    const groupLink = screen.getByText('그룹').closest('a');
    expect(groupLink).not.toBeNull();
    expect(groupLink!.getAttribute('href')).toBe('/admin/groups');

    const chatLink = screen.getByText('챗방').closest('a');
    expect(chatLink).not.toBeNull();
    expect(chatLink!.getAttribute('href')).toBe('/super_admin/chat');

    const classroomLink = screen.getByText('클래스룸').closest('a');
    expect(classroomLink).not.toBeNull();
    expect(classroomLink!.getAttribute('href')).toBe('/super_admin/classrooms');
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

    // 대시보드 항목은 admin 사이드바에서 제거됨 — /admin 경로가 곧 계정 관리 화면이라
    // 이전엔 "대시보드" 와 "계정" 두 항목이 같은 경로를 가리키는 중복이었다.
    expect(screen.getByText('계정')).toBeDefined();
    expect(screen.getByText('그룹')).toBeDefined();
    expect(screen.getByText('챗방')).toBeDefined();
    expect(screen.getByText('클래스룸')).toBeDefined();

    const groupLink = screen.getByText('그룹').closest('a');
    expect(groupLink).not.toBeNull();
    expect(groupLink!.getAttribute('href')).toBe('/admin/groups');

    const chatLink = screen.getByText('챗방').closest('a');
    expect(chatLink).not.toBeNull();
    expect(chatLink!.getAttribute('href')).toBe('/admin/chat');

    const classroomLink = screen.getByText('클래스룸').closest('a');
    expect(classroomLink).not.toBeNull();
    expect(classroomLink!.getAttribute('href')).toBe('/admin/classrooms');

    expect(screen.queryByText('감사 로그')).toBeNull();
    expect(screen.queryByText('시스템 설정')).toBeNull();
  });

  // 미구현 라우트를 가리키던 항목은 클릭 불가 span 으로 렌더 (Link 로 두면 RootRedirect 로 튄다).
  it('renders unimplemented items as disabled non-clickable spans (aria-disabled)', () => {
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

    // v0.103: 라벨은 <span aria-disabled> > <span> 구조. 외부 span 에서 aria-disabled 확인.
    const settingsOuter = screen.getByText('시스템 설정').closest('[aria-disabled]');
    expect(settingsOuter).not.toBeNull();
    expect(settingsOuter!.getAttribute('aria-disabled')).toBe('true');
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

  // v0.103: 사이드바 각 나비 항목이 lucide-react 아이콘을 SVG 로 렌더 (aria-hidden).
  it('v0.103: sidebar nav items render lucide icons as aria-hidden SVG next to labels', () => {
    render(
      <MemoryRouter initialEntries={['/super_admin']}>
        <AppShell role="super_admin" pageTitle="슈퍼 관리자">
          <div>내용</div>
        </AppShell>
      </MemoryRouter>,
    );

    // 대시보드 · 감사 로그 등 active/inactive 각각 아이콘 존재.
    const auditLogLink = screen.getByText('감사 로그').closest('a');
    expect(auditLogLink).not.toBeNull();
    const auditSvg = auditLogLink!.querySelector('svg');
    expect(auditSvg).not.toBeNull();
    expect(auditSvg!.getAttribute('aria-hidden')).toBe('true');

    // disabled 항목 (시스템 설정) 도 아이콘 렌더.
    const settingsOuter = screen.getByText('시스템 설정').closest('[aria-disabled]');
    expect(settingsOuter).not.toBeNull();
    const settingsSvg = (settingsOuter as HTMLElement).querySelector('svg');
    expect(settingsSvg).not.toBeNull();
    expect(settingsSvg!.getAttribute('aria-hidden')).toBe('true');
  });

  // v0.103: 활성 항목은 aria-current=page + font-semibold + SVG stroke-width 2.25 (inactive 2).
  it('v0.103: active nav item marks aria-current=page, font-semibold, thicker SVG stroke', () => {
    render(
      <MemoryRouter initialEntries={['/super_admin/audit']}>
        <AppShell role="super_admin" pageTitle="관리자">
          <div>내용</div>
        </AppShell>
      </MemoryRouter>,
    );

    const auditLink = screen.getByText('감사 로그').closest('a');
    expect(auditLink).not.toBeNull();
    expect(auditLink!.getAttribute('aria-current')).toBe('page');
    expect(auditLink!.className).toContain('font-semibold');

    // 활성 SVG 는 stroke-width=2.25, aria-hidden=true.
    const activeSvg = auditLink!.querySelector('svg');
    expect(activeSvg).not.toBeNull();
    expect(activeSvg!.getAttribute('aria-hidden')).toBe('true');
    expect(activeSvg!.getAttribute('stroke-width')).toBe('2.25');

    // 비활성 항목은 aria-current 없음 · SVG stroke-width=2.
    const groupLink = screen.getByText('그룹').closest('a');
    expect(groupLink!.getAttribute('aria-current')).toBeNull();
    const inactiveSvg = groupLink!.querySelector('svg');
    expect(inactiveSvg).not.toBeNull();
    expect(inactiveSvg!.getAttribute('stroke-width')).toBe('2');
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
