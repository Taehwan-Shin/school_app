import { describe, it, expect } from 'vitest';
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

  it('li 각각 key 는 getKey 결과', () => {
    const { container } = render(
      <BulkFailureList
        items={[{ id: 'x1' }, { id: 'x2' }]}
        getKey={(x) => x.id}
        renderItem={(x) => x.id}
        testId="bfl-keys"
      />,
    );
    const lis = container.querySelectorAll('li');
    expect(lis.length).toBe(2);
    // key 는 DOM 에 노출되지 않음 · 렌더된 text 로 확인.
    expect(lis[0].textContent).toBe('x1');
    expect(lis[1].textContent).toBe('x2');
  });
});
