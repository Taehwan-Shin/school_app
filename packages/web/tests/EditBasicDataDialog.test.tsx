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

import { EditBasicDataDialog } from '../src/routes/admin/EditBasicDataDialog.js';

describe('EditBasicDataDialog component', () => {
  const sampleInitialData: BasicDataYear = {
    year: 2026,
    grades: [
      { grade: 1, classes: ['A', 'B'] },
      { grade: 2, classes: ['1', '2', '3'] },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPending = false;
    mockError = null;
  });

  it('scenario 1: renders rows initialized from initialData when open is true', () => {
    render(
      <EditBasicDataDialog
        open={true}
        onOpenChange={vi.fn()}
        year={2026}
        initialData={sampleInitialData}
      />,
    );

    const grade0 = screen.getByTestId('edit-basic-data-grade-0') as HTMLInputElement;
    const classes0 = screen.getByTestId('edit-basic-data-classes-0') as HTMLInputElement;
    const grade1 = screen.getByTestId('edit-basic-data-grade-1') as HTMLInputElement;
    const classes1 = screen.getByTestId('edit-basic-data-classes-1') as HTMLInputElement;

    expect(grade0.value).toBe('1');
    expect(classes0.value).toBe('A, B');
    expect(grade1.value).toBe('2');
    expect(classes1.value).toBe('1, 2, 3');
  });

  it('scenario 2: renders single new row (grade 1, empty classes) when initialData is null', () => {
    render(
      <EditBasicDataDialog
        open={true}
        onOpenChange={vi.fn()}
        year={2026}
        initialData={null}
      />,
    );

    const grade0 = screen.getByTestId('edit-basic-data-grade-0') as HTMLInputElement;
    const classes0 = screen.getByTestId('edit-basic-data-classes-0') as HTMLInputElement;

    expect(grade0.value).toBe('1');
    expect(classes0.value).toBe('');
    expect(screen.queryByTestId('edit-basic-data-grade-1')).toBeNull();
  });

  it('scenario 3: clicking add row button adds one more row', () => {
    render(
      <EditBasicDataDialog
        open={true}
        onOpenChange={vi.fn()}
        year={2026}
        initialData={null}
      />,
    );

    expect(screen.queryByTestId('edit-basic-data-grade-1')).toBeNull();

    fireEvent.click(screen.getByTestId('edit-basic-data-add'));

    expect(screen.getByTestId('edit-basic-data-grade-0')).toBeDefined();
    expect(screen.getByTestId('edit-basic-data-grade-1')).toBeDefined();
  });

  it('scenario 4: clicking remove button removes the corresponding row', () => {
    render(
      <EditBasicDataDialog
        open={true}
        onOpenChange={vi.fn()}
        year={2026}
        initialData={sampleInitialData}
      />,
    );

    expect(screen.getByTestId('edit-basic-data-grade-0')).toBeDefined();
    expect(screen.getByTestId('edit-basic-data-grade-1')).toBeDefined();

    fireEvent.click(screen.getByTestId('edit-basic-data-remove-0'));

    const remainingGrade = screen.getByTestId('edit-basic-data-grade-0') as HTMLInputElement;
    expect(remainingGrade.value).toBe('2');
    expect(screen.queryByTestId('edit-basic-data-grade-1')).toBeNull();
  });

  it('scenario 5: submitting valid form calls mutation and closes dialog on success', async () => {
    mockMutateAsync.mockResolvedValueOnce({
      year: 2026,
      updatedAt: 1788480000000,
    });
    const onOpenChange = vi.fn();

    render(
      <EditBasicDataDialog
        open={true}
        onOpenChange={onOpenChange}
        year={2026}
        initialData={null}
      />,
    );

    const gradeInput = screen.getByTestId('edit-basic-data-grade-0');
    const classesInput = screen.getByTestId('edit-basic-data-classes-0');

    fireEvent.change(gradeInput, { target: { value: '1' } });
    fireEvent.change(classesInput, { target: { value: '1, 2, 3' } });

    fireEvent.click(screen.getByTestId('edit-basic-data-submit'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        year: 2026,
        grades: [{ grade: 1, classes: ['1', '2', '3'] }],
      });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('scenario 6: initializes departments input with comma-separated list when initialData contains departments', () => {
    const dataWithDepartments: BasicDataYear = {
      year: 2026,
      grades: [{ grade: 1, classes: ['A'] }],
      departments: ['국어과', '수학과'],
    };

    render(
      <EditBasicDataDialog
        open={true}
        onOpenChange={vi.fn()}
        year={2026}
        initialData={dataWithDepartments}
      />,
    );

    const deptsInput = screen.getByTestId('edit-basic-data-departments') as HTMLInputElement;
    expect(deptsInput.value).toBe('국어과, 수학과');
  });

  it('scenario 7: submitting form with departments calls mutation including departments array', async () => {
    mockMutateAsync.mockResolvedValueOnce({
      year: 2026,
      updatedAt: 1788480000000,
    });
    const onOpenChange = vi.fn();

    render(
      <EditBasicDataDialog
        open={true}
        onOpenChange={onOpenChange}
        year={2026}
        initialData={null}
      />,
    );

    const gradeInput = screen.getByTestId('edit-basic-data-grade-0');
    const classesInput = screen.getByTestId('edit-basic-data-classes-0');
    const deptsInput = screen.getByTestId('edit-basic-data-departments');

    fireEvent.change(gradeInput, { target: { value: '1' } });
    fireEvent.change(classesInput, { target: { value: '1, 2, 3' } });
    fireEvent.change(deptsInput, { target: { value: '국어과, 수학과, 영어과' } });

    fireEvent.click(screen.getByTestId('edit-basic-data-submit'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        year: 2026,
        grades: [{ grade: 1, classes: ['1', '2', '3'] }],
        departments: ['국어과', '수학과', '영어과'],
      });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
