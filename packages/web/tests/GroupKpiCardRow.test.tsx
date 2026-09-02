import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

const mockUseGroupsList = vi.fn();

vi.mock('../src/api/groupsList.js', () => ({
  useGroupsList: () => mockUseGroupsList(),
}));

import { GroupKpiCardRow } from '../src/components/dashboard/GroupKpiCardRow.js';

function renderWithRouter(ui: React.ReactElement, initialEntries: string[] = ['/admin/groups']) {
  return render(<MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>);
}

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
}

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

    renderWithRouter(<GroupKpiCardRow />);

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

    renderWithRouter(<GroupKpiCardRow />);

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

    renderWithRouter(<GroupKpiCardRow />);

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

  it('scenario 4: reflects active card and button tag when URL contains filter query', () => {
    mockUseGroupsList.mockReturnValue({
      data: { groups: [] },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderWithRouter(<GroupKpiCardRow />, ['/admin/groups?filter=with-members']);

    const totalCard = screen.getByTestId('kpi-card-총 그룹');
    const withMembersCard = screen.getByTestId('kpi-card-멤버 있는 그룹');
    const emptyCard = screen.getByTestId('kpi-card-빈 그룹');
    const avgCard = screen.getByTestId('kpi-card-평균 멤버 수');

    expect(totalCard.tagName).toBe('DIV');
    expect(totalCard.getAttribute('data-active')).toBe('false');

    expect(withMembersCard.tagName).toBe('BUTTON');
    expect(withMembersCard.getAttribute('data-active')).toBe('true');

    expect(emptyCard.tagName).toBe('BUTTON');
    expect(emptyCard.getAttribute('data-active')).toBe('false');

    expect(avgCard.tagName).toBe('DIV');
    expect(avgCard.getAttribute('data-active')).toBe('false');
  });

  it('scenario 5: updates URL search params when clicking KPI cards and toggles off on reclick', () => {
    mockUseGroupsList.mockReturnValue({
      data: { groups: [] },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderWithRouter(
      <>
        <GroupKpiCardRow />
        <LocationDisplay />
      </>,
      ['/admin/groups'],
    );

    const withMembersCard = screen.getByTestId('kpi-card-멤버 있는 그룹');
    const emptyCard = screen.getByTestId('kpi-card-빈 그룹');
    const locDisplay = screen.getByTestId('location-search');

    expect(locDisplay.textContent).toBe('');
    expect(withMembersCard.getAttribute('data-active')).toBe('false');

    // Click 'with-members' card -> URL becomes ?filter=with-members
    fireEvent.click(withMembersCard);
    expect(locDisplay.textContent).toBe('?filter=with-members');
    expect(withMembersCard.getAttribute('data-active')).toBe('true');

    // Click 'with-members' card again -> toggle off
    fireEvent.click(withMembersCard);
    expect(locDisplay.textContent).toBe('');
    expect(withMembersCard.getAttribute('data-active')).toBe('false');

    // Click 'empty' card -> URL becomes ?filter=empty
    fireEvent.click(emptyCard);
    expect(locDisplay.textContent).toBe('?filter=empty');
    expect(emptyCard.getAttribute('data-active')).toBe('true');

    // Click 'empty' card again -> toggle off
    fireEvent.click(emptyCard);
    expect(locDisplay.textContent).toBe('');
    expect(emptyCard.getAttribute('data-active')).toBe('false');
  });
});
