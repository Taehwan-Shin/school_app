import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { BasicDataYear } from '@school-app/shared';

const mockMutateAsync = vi.fn();
let mockIsPending = false;
let mockError: Error | null = null;

vi.mock('../src/api/basicDataSet.js', () => ({
  useBasicDataSet: () => ({
    mutateAsync: mockMutateAsync,
    isPending: mockIsPending,
    error: mockError,
  }),
}));

import { EditRostersDialog } from '../src/routes/admin/EditRostersDialog.js';

describe('EditRostersDialog component', () => {
  const sampleInitialData: BasicDataYear = {
    year: 2026,
    grades: [
      { grade: 1, classes: ['A', 'B'] },
      { grade: 2, classes: ['1'] },
    ],
    departments: ['국어과', '수학과'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPending = false;
    mockError = null;
  });

  it('scenario 1: does not render dialog content when open is false', () => {
    render(
      <EditRostersDialog
        open={false}
        onOpenChange={vi.fn()}
        year={2026}
        initialData={sampleInitialData}
      />,
    );

    expect(screen.queryByTestId('edit-rosters-1-A')).toBeNull();
    expect(screen.queryByText('2026년 학생 명단 편집')).toBeNull();
  });

  it('scenario 2: renders all textareas empty when rosters is undefined', () => {
    render(
      <EditRostersDialog
        open={true}
        onOpenChange={vi.fn()}
        year={2026}
        initialData={sampleInitialData}
      />,
    );

    const textarea1A = screen.getByTestId('edit-rosters-1-A') as HTMLTextAreaElement;
    const textarea1B = screen.getByTestId('edit-rosters-1-B') as HTMLTextAreaElement;
    const textarea21 = screen.getByTestId('edit-rosters-2-1') as HTMLTextAreaElement;

    expect(textarea1A.value).toBe('');
    expect(textarea1B.value).toBe('');
    expect(textarea21.value).toBe('');
  });

  it('scenario 3: renders textareas initialized with newline-joined emails when rosters exist', () => {
    const dataWithRosters: BasicDataYear = {
      ...sampleInitialData,
      rosters: {
        '1': {
          A: ['student1@cam.hs.kr', 'student2@cam.hs.kr'],
          B: ['student3@cam.hs.kr'],
        },
        '2': {
          '1': [],
        },
      },
    };

    render(
      <EditRostersDialog
        open={true}
        onOpenChange={vi.fn()}
        year={2026}
        initialData={dataWithRosters}
      />,
    );

    const textarea1A = screen.getByTestId('edit-rosters-1-A') as HTMLTextAreaElement;
    const textarea1B = screen.getByTestId('edit-rosters-1-B') as HTMLTextAreaElement;
    const textarea21 = screen.getByTestId('edit-rosters-2-1') as HTMLTextAreaElement;

    expect(textarea1A.value).toBe('student1@cam.hs.kr\nstudent2@cam.hs.kr');
    expect(textarea1B.value).toBe('student3@cam.hs.kr');
    expect(textarea21.value).toBe('');
  });

  it('scenario 4: editing textarea updates student count in real time', () => {
    render(
      <EditRostersDialog
        open={true}
        onOpenChange={vi.fn()}
        year={2026}
        initialData={sampleInitialData}
      />,
    );

    const textarea1A = screen.getByTestId('edit-rosters-1-A');
    fireEvent.change(textarea1A, {
      target: { value: 's1@cam.hs.kr\ns2@cam.hs.kr\n\ns3@cam.hs.kr\n   ' },
    });

    expect(screen.getByText('(3명)')).toBeDefined();
  });

  it('scenario 5: submitting valid form calls saveBasicData including rosters, grades, and departments', async () => {
    mockMutateAsync.mockResolvedValueOnce({
      year: 2026,
      updatedAt: 1788480000000,
    });
    const onOpenChange = vi.fn();

    render(
      <EditRostersDialog
        open={true}
        onOpenChange={onOpenChange}
        year={2026}
        initialData={sampleInitialData}
      />,
    );

    const textarea1A = screen.getByTestId('edit-rosters-1-A');
    fireEvent.change(textarea1A, {
      target: { value: 's1@cam.hs.kr\ns2@cam.hs.kr' },
    });

    fireEvent.click(screen.getByTestId('edit-rosters-submit'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        year: 2026,
        grades: sampleInitialData.grades,
        departments: sampleInitialData.departments,
        rosters: {
          '1': {
            A: ['s1@cam.hs.kr', 's2@cam.hs.kr'],
          },
        },
      });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
