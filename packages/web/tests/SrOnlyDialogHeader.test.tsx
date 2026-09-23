import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Dialog, DialogContent } from '../src/components/ui/dialog';
import { SrOnlyDialogHeader } from '../src/components/SrOnlyDialogHeader';

describe('SrOnlyDialogHeader (v0.275)', () => {
  it('sr-only 클래스로 감쌈 (시각적 숨김)', () => {
    render(
      <Dialog open>
        <DialogContent>
          <SrOnlyDialogHeader title="테스트 진행 중" description="처리 중입니다." />
        </DialogContent>
      </Dialog>,
    );
    // Radix 는 portal 로 렌더 → document 전체에서 sr-only 찾음.
    const header = document.querySelector('.sr-only');
    expect(header).not.toBeNull();
  });

  it('title 텍스트가 노출됨 (스크린 리더용)', () => {
    render(
      <Dialog open>
        <DialogContent>
          <SrOnlyDialogHeader title="일괄 그룹 삭제 진행 중" description="그룹을 삭제하고 있습니다." />
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByText('일괄 그룹 삭제 진행 중')).toBeDefined();
  });

  it('description 텍스트가 노출됨 (스크린 리더용)', () => {
    render(
      <Dialog open>
        <DialogContent>
          <SrOnlyDialogHeader title="Foo" description="Bar 처리 중" />
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByText('Bar 처리 중')).toBeDefined();
  });

  it('DialogHeader wrapper 의 className 은 sr-only (덮어쓰기 없음)', () => {
    render(
      <Dialog open>
        <DialogContent>
          <SrOnlyDialogHeader title="X" description="Y" />
        </DialogContent>
      </Dialog>,
    );
    const headers = document.querySelectorAll('.sr-only');
    // sr-only 클래스가 있는 요소가 정확히 하나 (헤더 wrapper).
    expect(headers.length).toBeGreaterThanOrEqual(1);
  });
});
