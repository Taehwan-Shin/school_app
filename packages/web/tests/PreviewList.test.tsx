import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PreviewList } from '../src/components/PreviewList';

describe('PreviewList (v0.261)', () => {
  it('items <= limit → 모두 노출 · 「외 N」 미노출', () => {
    render(
      <PreviewList
        items={['a@x.com', 'b@x.com', 'c@x.com']}
        getKey={(e) => e}
        renderItem={(e) => e}
      />,
    );
    expect(screen.getByText('a@x.com')).toBeDefined();
    expect(screen.getByText('c@x.com')).toBeDefined();
    expect(screen.queryByText(/외 /)).toBeNull();
  });

  it('items > limit (기본 5) → 첫 5개 노출 + 「... 외 N건」', () => {
    const items = Array.from({ length: 8 }, (_, i) => `user${i}`);
    render(<PreviewList items={items} getKey={(e) => e} renderItem={(e) => e} />);
    expect(screen.getByText('user0')).toBeDefined();
    expect(screen.getByText('user4')).toBeDefined();
    expect(screen.queryByText('user5')).toBeNull();
    expect(screen.getByText(/외 3건/)).toBeDefined();
  });

  it('unit prop 으로 접미사 커스텀 (「명」)', () => {
    const items = Array.from({ length: 7 }, (_, i) => `email${i}`);
    render(<PreviewList items={items} getKey={(e) => e} renderItem={(e) => e} unit="명" />);
    expect(screen.getByText(/외 2명/)).toBeDefined();
  });

  it('limit prop 으로 노출 개수 변경', () => {
    const items = Array.from({ length: 10 }, (_, i) => `x${i}`);
    render(
      <PreviewList
        items={items}
        getKey={(e) => e}
        renderItem={(e) => e}
        limit={3}
      />,
    );
    expect(screen.getByText('x0')).toBeDefined();
    expect(screen.getByText('x2')).toBeDefined();
    expect(screen.queryByText('x3')).toBeNull();
    expect(screen.getByText(/외 7건/)).toBeDefined();
  });

  it('renderItem 은 ReactNode 반환 지원 (JSX)', () => {
    render(
      <PreviewList
        items={[{ id: '1', name: 'Alice' }]}
        getKey={(x) => x.id}
        renderItem={(x) => <span data-testid={`item-${x.id}`}>{x.name}</span>}
      />,
    );
    expect(screen.getByTestId('item-1').textContent).toBe('Alice');
  });

  it('items 빈 배열 → 빈 ul · 「외 0」 미노출', () => {
    const { container } = render(
      <PreviewList items={[]} getKey={(e: string) => e} renderItem={(e) => e} />,
    );
    const ul = container.querySelector('ul');
    expect(ul).not.toBeNull();
    expect(ul?.children.length).toBe(0);
  });
});
