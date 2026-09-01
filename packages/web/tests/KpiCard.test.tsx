import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockUseUsersList = vi.fn();

vi.mock('../src/api/usersList.js', () => ({
  useUsersList: () => mockUseUsersList(),
}));

import { KpiCard } from '../src/components/dashboard/KpiCard.js';
import { KpiCardRow } from '../src/components/dashboard/KpiCardRow.js';

describe('KpiCard & KpiCardRow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('KpiCard component', () => {
    it('renders label and value with proper styling and data-testid', () => {
      render(<KpiCard label="총 사용자" value={428} />);
      const card = screen.getByTestId('kpi-card-총 사용자');
      expect(card).toBeDefined();
      expect(screen.getByText('총 사용자')).toBeDefined();
      expect(screen.getByText('428')).toBeDefined();
    });

    it('renders dash placeholder when loading is true', () => {
      render(<KpiCard label="관리자" value={10} loading={true} />);
      const card = screen.getByTestId('kpi-card-관리자');
      expect(card).toBeDefined();
      expect(screen.getByText('관리자')).toBeDefined();
      expect(screen.getByText('—')).toBeDefined();
      expect(screen.queryByText('10')).toBeNull();
    });
  });

  describe('KpiCardRow scenarios', () => {
    it('scenario 1: renders all 4 cards with dash values when loading', () => {
      mockUseUsersList.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
      });

      render(<KpiCardRow />);

      const totalCard = screen.getByTestId('kpi-card-총 사용자');
      const adminCard = screen.getByTestId('kpi-card-관리자');
      const suspendedCard = screen.getByTestId('kpi-card-정지된 계정');
      const normalCard = screen.getByTestId('kpi-card-일반 사용자');

      expect(totalCard).toBeDefined();
      expect(adminCard).toBeDefined();
      expect(suspendedCard).toBeDefined();
      expect(normalCard).toBeDefined();

      const dashes = screen.getAllByText('—');
      expect(dashes.length).toBe(4);
    });

    it('scenario 2: renders accurate counts for 5 users (2 admin, 1 suspended, 2 normal)', () => {
      const mockUsers = [
        {
          email: 'admin1@cam.hs.kr',
          firstName: '관리자1',
          lastName: '김',
          orgUnitPath: '/',
          isAdmin: true,
          isSuspended: false,
        },
        {
          email: 'admin2@cam.hs.kr',
          firstName: '관리자2',
          lastName: '이',
          orgUnitPath: '/',
          isAdmin: true,
          isSuspended: false,
        },
        {
          email: 'suspended@cam.hs.kr',
          firstName: '정지',
          lastName: '박',
          orgUnitPath: '/학생',
          isAdmin: false,
          isSuspended: true,
        },
        {
          email: 'user1@cam.hs.kr',
          firstName: '길동',
          lastName: '홍',
          orgUnitPath: '/교사',
          isAdmin: false,
          isSuspended: false,
        },
        {
          email: 'user2@cam.hs.kr',
          firstName: '영희',
          lastName: '최',
          orgUnitPath: '/학생',
          isAdmin: false,
          isSuspended: false,
        },
      ];

      mockUseUsersList.mockReturnValue({
        data: { users: mockUsers },
        isLoading: false,
        isError: false,
        error: null,
      });

      render(<KpiCardRow />);

      expect(screen.getByTestId('kpi-card-총 사용자')).toBeDefined();
      expect(screen.getByTestId('kpi-card-관리자')).toBeDefined();
      expect(screen.getByTestId('kpi-card-정지된 계정')).toBeDefined();
      expect(screen.getByTestId('kpi-card-일반 사용자')).toBeDefined();

      expect(screen.getByTestId('kpi-card-총 사용자').textContent).toContain('5');
      expect(screen.getByTestId('kpi-card-관리자').textContent).toContain('2');
      expect(screen.getByTestId('kpi-card-정지된 계정').textContent).toContain('1');
      expect(screen.getByTestId('kpi-card-일반 사용자').textContent).toContain('2');
    });

    it('scenario 3: renders all 4 cards with dash values on error', () => {
      mockUseUsersList.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error('Query error'),
      });

      render(<KpiCardRow />);

      const totalCard = screen.getByTestId('kpi-card-총 사용자');
      const adminCard = screen.getByTestId('kpi-card-관리자');
      const suspendedCard = screen.getByTestId('kpi-card-정지된 계정');
      const normalCard = screen.getByTestId('kpi-card-일반 사용자');

      expect(totalCard).toBeDefined();
      expect(adminCard).toBeDefined();
      expect(suspendedCard).toBeDefined();
      expect(normalCard).toBeDefined();

      const dashes = screen.getAllByText('—');
      expect(dashes.length).toBe(4);
    });
  });
});
