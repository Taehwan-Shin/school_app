import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

/**
 * useAuth 를 매 테스트에서 재구성할 수 있도록 mock.
 */
const mockUseAuth = vi.fn();
vi.mock('../src/lib/auth', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../src/lib/firebase', () => ({
  auth: { name: 'mock-auth' },
  app: {},
  db: {},
  functions: {},
}));

import { RoleGuard } from '../src/routes/RoleGuard.js';

function AdminPage() {
  return <div data-testid="admin-page">admin content</div>;
}
function LoginPage() {
  return <div data-testid="login-page">login</div>;
}
function SuperAdminPage() {
  return <div data-testid="super-admin-page">super admin content</div>;
}
function TeacherPage() {
  return <div data-testid="teacher-page">teacher content</div>;
}

function renderWithRoute(initialPath: string, guardProps: React.ComponentProps<typeof RoleGuard>) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/super_admin" element={<SuperAdminPage />} />
        <Route path="/teacher" element={<TeacherPage />} />
        <Route element={<RoleGuard {...guardProps} />}>
          <Route path="/admin" element={<AdminPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('RoleGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects unauthenticated users to /login (expectedRoles form)', () => {
    mockUseAuth.mockReturnValue({ user: null, role: null, loading: false, error: null });
    renderWithRoute('/admin', { expectedRoles: ['super_admin', 'admin'] });
    expect(screen.getByTestId('login-page')).toBeDefined();
  });

  it('lets admin access /admin when expectedRoles includes admin', () => {
    mockUseAuth.mockReturnValue({
      user: { uid: 'u1' } as any,
      role: 'admin',
      loading: false,
      error: null,
    });
    renderWithRoute('/admin', { expectedRoles: ['super_admin', 'admin'] });
    expect(screen.getByTestId('admin-page')).toBeDefined();
  });

  it('lets super_admin access /admin (regression: previously blocked when only admin was expected)', () => {
    mockUseAuth.mockReturnValue({
      user: { uid: 'u1' } as any,
      role: 'super_admin',
      loading: false,
      error: null,
    });
    renderWithRoute('/admin', { expectedRoles: ['super_admin', 'admin'] });
    expect(screen.getByTestId('admin-page')).toBeDefined();
  });

  it('redirects teacher trying /admin back to their own route', () => {
    mockUseAuth.mockReturnValue({
      user: { uid: 'u1' } as any,
      role: 'teacher',
      loading: false,
      error: null,
    });
    renderWithRoute('/admin', { expectedRoles: ['super_admin', 'admin'] });
    expect(screen.getByTestId('teacher-page')).toBeDefined();
  });

  it('single-role expectedRole syntax still works (backward compat)', () => {
    mockUseAuth.mockReturnValue({
      user: { uid: 'u1' } as any,
      role: 'admin',
      loading: false,
      error: null,
    });
    renderWithRoute('/admin', { expectedRole: 'admin' });
    expect(screen.getByTestId('admin-page')).toBeDefined();
  });

  it('shows loading indicator while auth is loading', () => {
    mockUseAuth.mockReturnValue({ user: null, role: null, loading: true, error: null });
    renderWithRoute('/admin', { expectedRoles: ['super_admin', 'admin'] });
    expect(screen.getByText(/권한 확인 중/)).toBeDefined();
  });
});
