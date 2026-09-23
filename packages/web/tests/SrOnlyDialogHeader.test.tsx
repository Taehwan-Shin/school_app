import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Dialog, DialogContent } from '../src/components/ui/dialog';
import { SrOnlyDialogHeader } from '../src/components/SrOnlyDialogHeader';

// 참고: DialogContent 는 항상 자체 닫기 라벨 <span className="sr-only">닫기</span>
// 를 렌더한다 (packages/web/src/components/ui/dialog.tsx). 그래서 단순히
// document.querySelector('.sr-only') 를 확인하는 것은 헤더 wrapper 계약을 실제로
// 보호하지 못한다 → v0.275 R1 F-A. 각 회귀는 title/description 텍스트를
// role/name 으로 찾은 뒤 조상 요소를 걸어올라가 sr-only 클래스가 실제 header
// wrapper 에 붙어 있는지 검증한다.

function findAncestorWithClass(el: Element | null, cls: string): Element | null {
  let cur = el?.parentElement ?? null;
  while (cur) {
    if (cur.classList.contains(cls)) return cur;
    cur = cur.parentElement;
  }
  return null;
}

describe('SrOnlyDialogHeader (v0.275)', () => {
  it('title 이 sr-only wrapper 안에 렌더', () => {
    render(
      <Dialog open>
        <DialogContent>
          <SrOnlyDialogHeader title="테스트 진행 중" description="처리 중입니다." />
        </DialogContent>
      </Dialog>,
    );
    const title = screen.getByText('테스트 진행 중');
    const srWrapper = findAncestorWithClass(title, 'sr-only');
    expect(srWrapper).not.toBeNull();
  });

  it('description 이 같은 sr-only wrapper 안에 렌더 (title 과 동일 부모)', () => {
    render(
      <Dialog open>
        <DialogContent>
          <SrOnlyDialogHeader title="Foo" description="Bar 처리 중" />
        </DialogContent>
      </Dialog>,
    );
    const title = screen.getByText('Foo');
    const desc = screen.getByText('Bar 처리 중');
    const titleWrapper = findAncestorWithClass(title, 'sr-only');
    const descWrapper = findAncestorWithClass(desc, 'sr-only');
    expect(titleWrapper).not.toBeNull();
    expect(descWrapper).toBe(titleWrapper);
  });

  it('title/description 텍스트가 스크린 리더에 노출됨', () => {
    render(
      <Dialog open>
        <DialogContent>
          <SrOnlyDialogHeader title="일괄 그룹 삭제 진행 중" description="그룹을 삭제하고 있습니다." />
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByText('일괄 그룹 삭제 진행 중')).toBeDefined();
    expect(screen.getByText('그룹을 삭제하고 있습니다.')).toBeDefined();
  });

  it('sr-only wrapper 는 DialogContent 자체 닫기 라벨과 분리된 별도 element', () => {
    render(
      <Dialog open>
        <DialogContent>
          <SrOnlyDialogHeader title="X" description="Y" />
        </DialogContent>
      </Dialog>,
    );
    // DialogContent 는 항상 닫기 라벨 <span className="sr-only">닫기</span> 를
    // 렌더한다. 헤더 wrapper (title/description 감싸는 요소) 와는 반드시 다른
    // element 여야 한다.
    const titleWrapper = findAncestorWithClass(screen.getByText('X'), 'sr-only');
    expect(titleWrapper).not.toBeNull();
    // getByText 로 닫기 라벨 존재 강제.
    const closeLabel = screen.getByText('닫기');
    // 닫기 label 자체가 sr-only span (packages/web/src/components/ui/dialog.tsx).
    expect(closeLabel.classList.contains('sr-only')).toBe(true);
    // 헤더 wrapper 와 다른 element 여야 함.
    expect(closeLabel).not.toBe(titleWrapper);
  });
});
