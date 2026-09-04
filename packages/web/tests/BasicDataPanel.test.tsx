import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const mockUseBasicDataGet = vi.fn();

vi.mock('../src/api/basicDataGet.js', () => ({
  useBasicDataGet: (year: number) => mockUseBasicDataGet(year),
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
});
