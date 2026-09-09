import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CapabilityMatrixPage } from '../src/routes/super_admin/capabilities';
import { ROLE_CAPABILITIES, ALL_CAPABILITIES } from '@school-app/shared';

vi.mock('../src/lib/auth', () => ({
  useAuth: () => ({
    user: { email: 'super@cam.hs.kr' },
    role: 'super_admin',
    loading: false,
  }),
  signOut: vi.fn(),
}));

vi.mock('../src/lib/theme', () => ({
  useTheme: () => ({
    theme: 'light',
    toggleTheme: vi.fn(),
    setTheme: vi.fn(),
  }),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/super_admin/capabilities']}>
      <CapabilityMatrixPage />
    </MemoryRouter>,
  );
}

describe('CapabilityMatrixPage', () => {
  // 시나리오 1: 모든 role × capability 셀이 shared 상수와 정확히 일치.
  it('scenario 1: renders O for granted capabilities and · for missing, matching shared source', () => {
    renderPage();
    const table = screen.getByTestId('capability-matrix-table');
    expect(table).toBeDefined();

    for (const cap of ALL_CAPABILITIES) {
      for (const role of ['super_admin', 'admin', 'teacher'] as const) {
        const cell = screen.getByTestId(`capability-matrix-cell-${cap}-${role}`);
        const expected = ROLE_CAPABILITIES[role].has(cap) ? 'O' : '·';
        expect(cell.textContent?.trim()).toBe(expected);
      }
    }
  });

  // 시나리오 2: role 총합 카운터가 실제 Set 크기와 일치.
  it('scenario 2: shows role totals matching Set sizes', () => {
    renderPage();
    for (const role of ['super_admin', 'admin', 'teacher'] as const) {
      const total = screen.getByTestId(`capability-matrix-total-${role}`);
      expect(total.textContent).toContain(
        `${ROLE_CAPABILITIES[role].size} / ${ALL_CAPABILITIES.length}`,
      );
    }
  });

  // 시나리오 3: super_admin 은 모든 capability 를 갖는다 (설계 계약 회귀 방지).
  it('scenario 3: super_admin holds all capabilities', () => {
    expect(ROLE_CAPABILITIES.super_admin.size).toBe(ALL_CAPABILITIES.length);
  });

  // 시나리오 4: admin 은 audit.read, system.manage_roles 를 갖지 않는다.
  it('scenario 4: admin lacks audit.read and system.manage_roles', () => {
    expect(ROLE_CAPABILITIES.admin.has('audit.read')).toBe(false);
    expect(ROLE_CAPABILITIES.admin.has('system.manage_roles')).toBe(false);
  });

  // 시나리오 5: teacher 는 classroom.* 만 (write/read/archive) 갖는다.
  it('scenario 5: teacher only has classroom read/write/archive', () => {
    const teacherCaps = ROLE_CAPABILITIES.teacher;
    expect(teacherCaps.has('classroom.read')).toBe(true);
    expect(teacherCaps.has('classroom.write')).toBe(true);
    expect(teacherCaps.has('classroom.archive')).toBe(true);
    expect(teacherCaps.has('classroom.transfer_owner')).toBe(false);
    expect(teacherCaps.has('users.read')).toBe(false);
    expect(teacherCaps.has('chat.write')).toBe(false);
  });

  // 시나리오 6: capability row 마다 서버 리터럴 표시.
  it('scenario 6: each row shows the raw capability literal for developer reference', () => {
    renderPage();
    for (const cap of ALL_CAPABILITIES) {
      const row = screen.getByTestId(`capability-matrix-row-${cap}`);
      expect(row.textContent).toContain(cap);
    }
  });
});
