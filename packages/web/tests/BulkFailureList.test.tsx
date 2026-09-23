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

  it('key 로 li DOM 정체성 유지 (rerender 전 li ref 캡처 → 재정렬 후 동일 노드 확인)', () => {
    // 인덱스 key 는 재정렬 시 각 li 를 다른 item 에 재사용해 DOM 노드가 그대로
    // 남지만 렌더 내용이 바뀌므로 「id → li」 매핑이 유지 안 된다.
    // 반면 getKey(item)=id 기반 key 는 각 li 가 자신의 item 을 따라다녀
    // rerender 전 캡처한 「id → li」 매핑이 그대로 유지된다.
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
    // rerender 전 각 id 의 li ref 캡처.
    const liA = screen.getByTestId('row-a').closest('li');
    const liB = screen.getByTestId('row-b').closest('li');
    const liC = screen.getByTestId('row-c').closest('li');
    expect(liA).not.toBeNull();
    rerender(
      <BulkFailureList
        items={items2}
        getKey={(x) => x.id}
        renderItem={(x) => <Row id={x.id} />}
        testId="bfl-reorder"
      />,
    );
    // 재정렬 후 각 id 의 li ref 를 다시 취득 → 저장했던 참조와 동일해야 한다.
    // (인덱스 key 였다면 row-a 는 이전 liC 위치의 li 를 가리키게 됨.)
    expect(screen.getByTestId('row-a').closest('li')).toBe(liA);
    expect(screen.getByTestId('row-b').closest('li')).toBe(liB);
    expect(screen.getByTestId('row-c').closest('li')).toBe(liC);
    // DOM 순서도 뒤집혔는지 확인 (완결 회귀).
    const rows = document.querySelectorAll('[data-testid^="row-"]');
    expect(rows[0].getAttribute('data-testid')).toBe('row-c');
    expect(rows[2].getAttribute('data-testid')).toBe('row-a');
  });
});
