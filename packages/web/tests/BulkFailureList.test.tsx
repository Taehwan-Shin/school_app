import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BulkFailureList } from '../src/components/BulkFailureList';

describe('BulkFailureList (v0.270)', () => {
  it('items 빈 배열 → 미렌더 (null)', () => {
    const { container } = render(
      <BulkFailureList<{ id: string }>
        items={[]}
        getKey={(x) => x.id}
        renderItem={(x) => x.id}
        testId="bfl-empty"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('items > 0 → ul 노출 · testId 적용', () => {
    render(
      <BulkFailureList
        items={[{ email: 'a@x.com', message: 'oops' }]}
        getKey={(f) => f.email}
        renderItem={(f) => `${f.email}: ${f.message}`}
        testId="bfl-basic"
      />,
    );
    const ul = screen.getByTestId('bfl-basic');
    expect(ul.tagName).toBe('UL');
    expect(ul.className).toContain('text-state-danger');
    expect(ul.className).toContain('max-h-40');
    expect(ul.textContent).toContain('a@x.com: oops');
  });

  it('items 여러 개 → 각각 li · getKey 로 key 지정', () => {
    render(
      <BulkFailureList
        items={[
          { email: 'a@x.com', message: 'e1' },
          { email: 'b@x.com', message: 'e2' },
          { email: 'c@x.com', message: 'e3' },
        ]}
        getKey={(f) => f.email}
        renderItem={(f) => `${f.email}: ${f.message}`}
        testId="bfl-multi"
      />,
    );
    const ul = screen.getByTestId('bfl-multi');
    expect(ul.querySelectorAll('li').length).toBe(3);
    expect(ul.textContent).toContain('a@x.com: e1');
    expect(ul.textContent).toContain('c@x.com: e3');
  });

  it('renderItem 은 JSX 반환 지원 (예: span/font-mono)', () => {
    render(
      <BulkFailureList
        items={[{ id: '1', name: 'Alice', message: 'fail' }]}
        getKey={(x) => x.id}
        renderItem={(x) => (
          <>
            <span data-testid={`item-${x.id}`} className="font-mono">{x.name}</span>: {x.message}
          </>
        )}
        testId="bfl-jsx"
      />,
    );
    expect(screen.getByTestId('item-1').textContent).toBe('Alice');
    expect(screen.getByTestId('item-1').className).toContain('font-mono');
  });

  it('getKey 는 각 item 마다 호출됨 (spy)', () => {
    const getKeySpy = vi.fn((x: { id: string }) => x.id);
    render(
      <BulkFailureList
        items={[{ id: 'x1' }, { id: 'x2' }, { id: 'x3' }]}
        getKey={getKeySpy}
        renderItem={(x) => x.id}
        testId="bfl-getkey-spy"
      />,
    );
    expect(getKeySpy).toHaveBeenCalledTimes(3);
    expect(getKeySpy).toHaveBeenNthCalledWith(1, { id: 'x1' });
    expect(getKeySpy).toHaveBeenNthCalledWith(2, { id: 'x2' });
    expect(getKeySpy).toHaveBeenNthCalledWith(3, { id: 'x3' });
  });

  it('key 로 li DOM 정체성 유지 (재정렬 시 순서만 뒤집힘)', () => {
    // key 가 id 기반이면 재정렬 시 React 가 DOM 노드를 재사용. 원본 li ref 를
    // 캡처해두면 재정렬 후 DOM 위치가 바뀌었어도 동일 노드가 유지된다.
    function Row({ id }: { id: string }) {
      return <span data-testid={`row-${id}`}>{id}</span>;
    }
    const items1 = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const items2 = [{ id: 'c' }, { id: 'b' }, { id: 'a' }];
    const { rerender } = render(
      <BulkFailureList
        items={items1}
        getKey={(x) => x.id}
        renderItem={(x) => <Row id={x.id} />}
        testId="bfl-reorder"
      />,
    );
    expect(screen.getByTestId('row-a')).toBeDefined();
    rerender(
      <BulkFailureList
        items={items2}
        getKey={(x) => x.id}
        renderItem={(x) => <Row id={x.id} />}
        testId="bfl-reorder"
      />,
    );
    // 재정렬 후에도 모든 id 렌더링 (key 가 id 기반이면 정상 재사용).
    expect(screen.getByTestId('row-a').textContent).toBe('a');
    expect(screen.getByTestId('row-c').textContent).toBe('c');
    // DOM 순서 확인.
    const rows = document.querySelectorAll('[data-testid^="row-"]');
    expect(rows[0].getAttribute('data-testid')).toBe('row-c');
    expect(rows[2].getAttribute('data-testid')).toBe('row-a');
  });
});
