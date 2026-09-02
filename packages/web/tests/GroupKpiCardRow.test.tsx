import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockUseGroupsList = vi.fn();

vi.mock('../src/api/groupsList.js', () => ({
  useGroupsList: () => mockUseGroupsList(),
}));

import { GroupKpiCardRow } from '../src/components/dashboard/GroupKpiCardRow.js';

describe('GroupKpiCardRow component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scenario 1: renders all 4 cards with dash values when loading', () => {
    mockUseGroupsList.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    });

    render(<GroupKpiCardRow />);

    const totalCard = screen.getByTestId('kpi-card-총 그룹');
    const withMembersCard = screen.getByTestId('kpi-card-멤버 있는 그룹');
    const emptyCard = screen.getByTestId('kpi-card-빈 그룹');
    const avgCard = screen.getByTestId('kpi-card-평균 멤버 수');

    expect(totalCard).toBeDefined();
    expect(withMembersCard).toBeDefined();
    expect(emptyCard).toBeDefined();
    expect(avgCard).toBeDefined();

    expect(totalCard.textContent).toContain('—');
    expect(withMembersCard.textContent).toContain('—');
    expect(emptyCard.textContent).toContain('—');
    expect(avgCard.textContent).toContain('—');

    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBe(4);
  });

  it('scenario 2: renders accurate counts for 4 groups (2 with members 5 and 10, 2 with 0 members)', () => {
    const mockGroups = [
      {
        email: 'group1@cam.hs.kr',
        name: '그룹1',
        description: '설명1',
        aliases: [],
        directMembersCount: 5,
      },
      {
        email: 'group2@cam.hs.kr',
        name: '그룹2',
        description: '설명2',
        aliases: [],
        directMembersCount: 10,
      },
      {
        email: 'group3@cam.hs.kr',
        name: '그룹3',
        description: '설명3',
        aliases: [],
        directMembersCount: 0,
      },
      {
        email: 'group4@cam.hs.kr',
        name: '그룹4',
        description: '설명4',
        aliases: [],
        directMembersCount: 0,
      },
    ];

    mockUseGroupsList.mockReturnValue({
      data: { groups: mockGroups },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<GroupKpiCardRow />);

    const totalCard = screen.getByTestId('kpi-card-총 그룹');
    const withMembersCard = screen.getByTestId('kpi-card-멤버 있는 그룹');
    const emptyCard = screen.getByTestId('kpi-card-빈 그룹');
    const avgCard = screen.getByTestId('kpi-card-평균 멤버 수');

    expect(totalCard).toBeDefined();
    expect(withMembersCard).toBeDefined();
    expect(emptyCard).toBeDefined();
    expect(avgCard).toBeDefined();

    expect(totalCard.textContent).toContain('4');
    expect(withMembersCard.textContent).toContain('2');
    expect(emptyCard.textContent).toContain('2');
    expect(avgCard.textContent).toContain('4');
  });

  it('scenario 3: renders all 4 cards with dash values on error', () => {
    mockUseGroupsList.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Query error'),
    });

    render(<GroupKpiCardRow />);

    const totalCard = screen.getByTestId('kpi-card-총 그룹');
    const withMembersCard = screen.getByTestId('kpi-card-멤버 있는 그룹');
    const emptyCard = screen.getByTestId('kpi-card-빈 그룹');
    const avgCard = screen.getByTestId('kpi-card-평균 멤버 수');

    expect(totalCard).toBeDefined();
    expect(withMembersCard).toBeDefined();
    expect(emptyCard).toBeDefined();
    expect(avgCard).toBeDefined();

    expect(totalCard.textContent).toContain('—');
    expect(withMembersCard.textContent).toContain('—');
    expect(emptyCard.textContent).toContain('—');
    expect(avgCard.textContent).toContain('—');

    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBe(4);
  });
});
