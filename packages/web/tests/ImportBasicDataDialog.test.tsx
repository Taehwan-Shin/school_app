import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockMutateAsync = vi.fn();

vi.mock('../src/api/basicDataSet.js', () => ({
  useBasicDataSet: () => ({
    mutateAsync: mockMutateAsync,
  }),
}));

import { ImportBasicDataDialog } from '../src/routes/admin/ImportBasicDataDialog.js';

class MockFileReader {
  result: string | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  readAsText(blob: Blob) {
    if (typeof blob.text === 'function') {
      blob.text().then((txt) => {
        this.result = txt;
        this.onload?.();
      });
    } else {
      setTimeout(() => {
        this.result = '';
        this.onload?.();
      }, 0);
    }
  }
}

describe('ImportBasicDataDialog component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('FileReader', MockFileReader);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('scenario 1: renders file input when open is true', () => {
    render(
      <ImportBasicDataDialog
        open={true}
        onOpenChange={vi.fn()}
        currentYear={2026}
      />,
    );

    expect(screen.getByTestId('import-basic-data-file-input')).toBeDefined();
    expect(screen.queryByTestId('import-basic-data-preview')).toBeNull();
    expect(screen.queryByTestId('import-basic-data-done')).toBeNull();
  });

  it('scenario 2: valid JSON file shows preview phase with correct counts', async () => {
    const validData = {
      year: 2026,
      grades: [
        { grade: 1, classes: ['1', '2'] },
        { grade: 2, classes: ['A', 'B', 'C'] },
      ],
      departments: ['국어과', '수학과'],
      rosters: {
        '1': {
          '1': ['student1@cam.hs.kr', 'student2@cam.hs.kr'],
        },
      },
    };

    const file = new File([JSON.stringify(validData)], 'valid.json', {
      type: 'application/json',
    });

    render(
      <ImportBasicDataDialog
        open={true}
        onOpenChange={vi.fn()}
        currentYear={2026}
      />,
    );

    const input = screen.getByTestId('import-basic-data-file-input');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByTestId('import-basic-data-preview')).toBeDefined();
    });

    const previewEl = screen.getByTestId('import-basic-data-preview');
    expect(previewEl.textContent).toContain('학년: 2');
    expect(previewEl.textContent).toContain('반: 5');
    expect(previewEl.textContent).toContain('학생: 2');
    expect(previewEl.textContent).toContain('부서: 2');
    expect(screen.getByTestId('import-basic-data-save-btn')).toBeDefined();
  });

  it('scenario 3: invalid JSON file shows parse-error message', async () => {
    const invalidData = {
      invalid: true,
    };

    const file = new File([JSON.stringify(invalidData)], 'invalid.json', {
      type: 'application/json',
    });

    render(
      <ImportBasicDataDialog
        open={true}
        onOpenChange={vi.fn()}
        currentYear={2026}
      />,
    );

    const input = screen.getByTestId('import-basic-data-file-input');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByTestId('import-basic-data-parse-error')).toBeDefined();
    });

    expect(screen.getByTestId('import-basic-data-parse-error').textContent).toContain(
      'JSON 이 basic_data 스키마와 일치하지 않습니다.',
    );
    expect(screen.queryByTestId('import-basic-data-preview')).toBeNull();
  });

  it('scenario 4: clicking save in preview phase calls saveBasicData and transitions to done phase', async () => {
    mockMutateAsync.mockResolvedValueOnce({ year: 2026, updatedAt: Date.now() });

    const validData = {
      year: 2026,
      grades: [{ grade: 1, classes: ['A'] }],
      departments: ['국어과'],
      rosters: {
        '1': {
          A: ['student@cam.hs.kr'],
        },
      },
    };

    const file = new File([JSON.stringify(validData)], 'valid.json', {
      type: 'application/json',
    });

    const onOpenChange = vi.fn();
    const onDone = vi.fn();

    render(
      <ImportBasicDataDialog
        open={true}
        onOpenChange={onOpenChange}
        currentYear={2026}
        onDone={onDone}
      />,
    );

    const input = screen.getByTestId('import-basic-data-file-input');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByTestId('import-basic-data-save-btn')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('import-basic-data-save-btn'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        year: 2026,
        grades: [{ grade: 1, classes: ['A'] }],
        departments: ['국어과'],
        rosters: {
          '1': {
            A: ['student@cam.hs.kr'],
          },
        },
      });
      expect(screen.getByTestId('import-basic-data-done')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onDone).toHaveBeenCalled();
  });

  it('scenario 5: blocks onOpenChange when in saving phase', async () => {
    let resolveSave!: (val: unknown) => void;
    const savePromise = new Promise((resolve) => {
      resolveSave = resolve;
    });
    mockMutateAsync.mockReturnValueOnce(savePromise);

    const validData = {
      year: 2026,
      grades: [{ grade: 1, classes: ['A'] }],
      departments: ['국어과'],
      rosters: {
        '1': {
          A: ['student@cam.hs.kr'],
        },
      },
    };

    const file = new File([JSON.stringify(validData)], 'valid.json', {
      type: 'application/json',
    });

    const onOpenChange = vi.fn();

    render(
      <ImportBasicDataDialog
        open={true}
        onOpenChange={onOpenChange}
        currentYear={2026}
      />,
    );

    const input = screen.getByTestId('import-basic-data-file-input');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByTestId('import-basic-data-save-btn')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('import-basic-data-save-btn'));

    await waitFor(() => {
      expect(screen.getByText('저장 중...')).toBeDefined();
    });

    // Attempt to close via Escape key press
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    expect(onOpenChange).not.toHaveBeenCalled();

    // Clean up pending save promise
    resolveSave({ year: 2026, updatedAt: Date.now() });
    await waitFor(() => {
      expect(screen.getByTestId('import-basic-data-done')).toBeDefined();
    });
  });
});
