import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const mockUseBasicDataGet = vi.fn();
const mockUseBasicDataListYears = vi.fn();

vi.mock('../src/api/basicDataGet.js', () => ({
  useBasicDataGet: (year: number) => mockUseBasicDataGet(year),
}));

vi.mock('../src/api/basicDataListYears.js', () => ({
  useBasicDataListYears: () => mockUseBasicDataListYears(),
}));

vi.mock('../src/api/basicDataSet.js', () => ({
  useBasicDataSet: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  }),
}));

import { BasicDataPanel } from '../src/routes/admin/BasicDataPanel.js';

describe('BasicDataPanel component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseBasicDataListYears.mockReturnValue({
      data: { years: [] },
      isLoading: false,
      isError: false,
      error: null,
    });
  });

  it('scenario 1: renders loading indicator when isLoading is true', () => {
    mockUseBasicDataGet.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    });

    render(<BasicDataPanel />);

    const loadingEl = screen.getByTestId('basic-data-loading');
    expect(loadingEl).toBeDefined();
    expect(loadingEl.textContent).toContain('불러오는 중...');
    expect(screen.queryByTestId('basic-data-error')).toBeNull();
    expect(screen.queryByTestId('basic-data-empty')).toBeNull();
    expect(screen.queryByTestId('basic-data-content')).toBeNull();
  });

  it('scenario 2: renders error message when isError is true', () => {
    mockUseBasicDataGet.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('permission-denied'),
    });

    render(<BasicDataPanel />);

    const errorEl = screen.getByTestId('basic-data-error');
    expect(errorEl).toBeDefined();
    expect(errorEl.textContent).toContain('기초값을 불러오지 못했습니다: permission-denied');
    expect(screen.queryByTestId('basic-data-loading')).toBeNull();
    expect(screen.queryByTestId('basic-data-empty')).toBeNull();
    expect(screen.queryByTestId('basic-data-content')).toBeNull();
  });

  it('scenario 3: renders empty message when data is null', () => {
    const currentYear = new Date().getFullYear();
    mockUseBasicDataGet.mockReturnValue({
      data: { data: null },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<BasicDataPanel />);

    const emptyEl = screen.getByTestId('basic-data-empty');
    expect(emptyEl).toBeDefined();
    expect(emptyEl.textContent).toContain(`${currentYear}년 기초값이 아직 설정되지 않았습니다.`);
    expect(screen.queryByTestId('basic-data-loading')).toBeNull();
    expect(screen.queryByTestId('basic-data-error')).toBeNull();
    expect(screen.queryByTestId('basic-data-content')).toBeNull();
  });

  it('scenario 4: renders content and badges when data exists', () => {
    const currentYear = new Date().getFullYear();
    mockUseBasicDataGet.mockReturnValue({
      data: {
        data: {
          year: currentYear,
          grades: [
            { grade: 1, classes: ['A', 'B'] },
            { grade: 2, classes: ['1', '2', '3'] },
          ],
          updatedAt: 1788480000000,
          updatedBy: 'admin@cam.hs.kr',
        },
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<BasicDataPanel />);

    const contentEl = screen.getByTestId('basic-data-content');
    expect(contentEl).toBeDefined();

    expect(screen.getByText('1학년')).toBeDefined();
    expect(screen.getByTestId('basic-data-class-1-A')).toBeDefined();
    expect(screen.getByTestId('basic-data-class-1-A').textContent).toBe('A');
    expect(screen.getByTestId('basic-data-class-1-B')).toBeDefined();
    expect(screen.getByTestId('basic-data-class-1-B').textContent).toBe('B');

    expect(screen.getByText('2학년')).toBeDefined();
    expect(screen.getByTestId('basic-data-class-2-1')).toBeDefined();
    expect(screen.getByTestId('basic-data-class-2-2')).toBeDefined();
    expect(screen.getByTestId('basic-data-class-2-3')).toBeDefined();

    expect(screen.getByText('admin@cam.hs.kr')).toBeDefined();
    expect(screen.queryByTestId('basic-data-loading')).toBeNull();
    expect(screen.queryByTestId('basic-data-error')).toBeNull();
    expect(screen.queryByTestId('basic-data-empty')).toBeNull();
  });

  it('scenario 5: renders edit button and opens EditBasicDataDialog when clicked', () => {
    mockUseBasicDataGet.mockReturnValue({
      data: { data: null },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<BasicDataPanel />);

    const editBtn = screen.getByTestId('basic-data-edit-btn');
    expect(editBtn).toBeDefined();

    fireEvent.click(editBtn);

    const currentYear = new Date().getFullYear();
    expect(screen.getByText(`${currentYear}년 기초값 편집`)).toBeDefined();
  });

  it('scenario 6: auto create groups button is disabled when data is null, enabled when data and grades exist', () => {
    mockUseBasicDataGet.mockReturnValue({
      data: { data: null },
      isLoading: false,
      isError: false,
      error: null,
    });

    const { rerender } = render(<BasicDataPanel />);
    const btnDisabled = screen.getByTestId('basic-data-auto-create-groups-btn') as HTMLButtonElement;
    expect(btnDisabled.disabled).toBe(true);

    const currentYear = new Date().getFullYear();
    mockUseBasicDataGet.mockReturnValue({
      data: {
        data: {
          year: currentYear,
          grades: [{ grade: 1, classes: ['A'] }],
          updatedAt: 1788480000000,
          updatedBy: 'admin@cam.hs.kr',
        },
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    rerender(<BasicDataPanel />);
    const btnEnabled = screen.getByTestId('basic-data-auto-create-groups-btn') as HTMLButtonElement;
    expect(btnEnabled.disabled).toBe(false);
  });

  it('scenario 7: renders departments section and badges when departments exist', () => {
    const currentYear = new Date().getFullYear();
    mockUseBasicDataGet.mockReturnValue({
      data: {
        data: {
          year: currentYear,
          grades: [{ grade: 1, classes: ['A'] }],
          departments: ['국어과', '수학과'],
          updatedAt: 1788480000000,
          updatedBy: 'admin@cam.hs.kr',
        },
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<BasicDataPanel />);

    const deptsEl = screen.getByTestId('basic-data-departments');
    expect(deptsEl).toBeDefined();

    const koreanDept = screen.getByTestId('basic-data-department-국어과');
    expect(koreanDept).toBeDefined();
    expect(koreanDept.textContent).toBe('국어과');

    const mathDept = screen.getByTestId('basic-data-department-수학과');
    expect(mathDept).toBeDefined();
    expect(mathDept.textContent).toBe('수학과');
  });

  it('scenario 8: auto create dept groups button is disabled when departments is absent, enabled when departments exist', () => {
    mockUseBasicDataGet.mockReturnValue({
      data: { data: null },
      isLoading: false,
      isError: false,
      error: null,
    });

    const { rerender } = render(<BasicDataPanel />);
    const btnDisabled = screen.getByTestId('basic-data-auto-create-dept-groups-btn') as HTMLButtonElement;
    expect(btnDisabled.disabled).toBe(true);

    const currentYear = new Date().getFullYear();
    mockUseBasicDataGet.mockReturnValue({
      data: {
        data: {
          year: currentYear,
          grades: [{ grade: 1, classes: ['A'] }],
          departments: ['국어과', '수학과'],
          updatedAt: 1788480000000,
          updatedBy: 'admin@cam.hs.kr',
        },
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    rerender(<BasicDataPanel />);
    const btnEnabled = screen.getByTestId('basic-data-auto-create-dept-groups-btn') as HTMLButtonElement;
    expect(btnEnabled.disabled).toBe(false);

    fireEvent.click(btnEnabled);
    expect(screen.getByRole('heading', { name: '부서 그룹 자동 생성' })).toBeDefined();
  });

  it('scenario 9: renders current year in year input by default', () => {
    const currentYear = new Date().getFullYear();
    mockUseBasicDataGet.mockReturnValue({
      data: { data: null },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<BasicDataPanel />);

    const yearInput = screen.getByTestId('basic-data-year-input') as HTMLInputElement;
    expect(yearInput).toBeDefined();
    expect(yearInput.value).toBe(String(currentYear));
    expect(mockUseBasicDataGet).toHaveBeenCalledWith(currentYear);
  });

  it('scenario 10: updates selectedYear and refetches when year input changes to valid year', () => {
    mockUseBasicDataGet.mockReturnValue({
      data: { data: null },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<BasicDataPanel />);

    const yearInput = screen.getByTestId('basic-data-year-input') as HTMLInputElement;
    fireEvent.change(yearInput, { target: { value: '2027' } });

    expect(yearInput.value).toBe('2027');
    expect(mockUseBasicDataGet).toHaveBeenCalledWith(2027);
  });

  it('scenario 11: renders year select dropdown when savedYears has items and updates input on selection', () => {
    mockUseBasicDataGet.mockReturnValue({
      data: { data: null },
      isLoading: false,
      isError: false,
      error: null,
    });
    mockUseBasicDataListYears.mockReturnValue({
      data: { years: [2026, 2025] },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<BasicDataPanel />);

    const selectEl = screen.getByTestId('basic-data-year-select') as HTMLSelectElement;
    expect(selectEl).toBeDefined();

    const option2026 = screen.getByRole('option', { name: '2026' }) as HTMLOptionElement;
    expect(option2026).toBeDefined();
    expect(option2026.value).toBe('2026');

    const option2025 = screen.getByRole('option', { name: '2025' }) as HTMLOptionElement;
    expect(option2025).toBeDefined();
    expect(option2025.value).toBe('2025');

    // Selecting 2025 updates year input and refetches basicDataGet with 2025
    fireEvent.change(selectEl, { target: { value: '2025' } });

    const yearInput = screen.getByTestId('basic-data-year-input') as HTMLInputElement;
    expect(yearInput.value).toBe('2025');
    expect(mockUseBasicDataGet).toHaveBeenCalledWith(2025);
  });

  it('scenario 12: rosters edit button is disabled when data is null or grades empty, enabled when grades exist', () => {
    mockUseBasicDataGet.mockReturnValue({
      data: { data: null },
      isLoading: false,
      isError: false,
      error: null,
    });

    const { rerender } = render(<BasicDataPanel />);
    const btnDisabled = screen.getByTestId('basic-data-rosters-edit-btn') as HTMLButtonElement;
    expect(btnDisabled.disabled).toBe(true);

    const currentYear = new Date().getFullYear();
    mockUseBasicDataGet.mockReturnValue({
      data: {
        data: {
          year: currentYear,
          grades: [{ grade: 1, classes: ['A'] }],
          updatedAt: 1788480000000,
          updatedBy: 'admin@cam.hs.kr',
        },
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    rerender(<BasicDataPanel />);
    const btnEnabled = screen.getByTestId('basic-data-rosters-edit-btn') as HTMLButtonElement;
    expect(btnEnabled.disabled).toBe(false);
  });

  it('scenario 13: renders roster student count badge when rosters exist', () => {
    const currentYear = new Date().getFullYear();
    mockUseBasicDataGet.mockReturnValue({
      data: {
        data: {
          year: currentYear,
          grades: [{ grade: 1, classes: ['A', 'B'] }],
          rosters: {
            '1': {
              A: ['s1@cam.hs.kr', 's2@cam.hs.kr'],
              B: [],
            },
          },
          updatedAt: 1788480000000,
          updatedBy: 'admin@cam.hs.kr',
        },
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<BasicDataPanel />);

    const badgeA = screen.getByTestId('basic-data-class-1-A');
    expect(badgeA).toBeDefined();
    expect(badgeA.textContent).toContain('(2)');

    const badgeB = screen.getByTestId('basic-data-class-1-B');
    expect(badgeB).toBeDefined();
    expect(badgeB.textContent).toBe('B');
  });
});

