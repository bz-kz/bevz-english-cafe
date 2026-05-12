/**
 * LessonsGridSection Component Smoke Tests
 * レッスン一覧グリッドのスモークテスト
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { LessonsGridSection } from '../LessonsGridSection';

// next/image / next/link を最小限モック（fill 等の非DOM属性は除外）
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, src }: { alt: string; src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img alt={alt} src={typeof src === 'string' ? src : ''} />
  ),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

describe('LessonsGridSection (smoke)', () => {
  it('renders without throwing and shows lesson titles', () => {
    render(<LessonsGridSection />);
    // セクション内に存在する代表的なレッスン名（カード見出し）
    expect(
      screen.getByRole('heading', { name: '無料体験レッスン' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'プライベートレッスン' })
    ).toBeInTheDocument();
  });

  it('renders all 6 lesson cards by default', () => {
    render(<LessonsGridSection />);
    // 各カードに h3 がひとつ
    const headings = screen.getAllByRole('heading', { level: 3 });
    expect(headings).toHaveLength(6);
  });

  it('filters cards when changing the lesson type select', () => {
    render(<LessonsGridSection />);
    const beforeCount = screen.getAllByRole('heading', { level: 3 }).length;
    expect(beforeCount).toBe(6);

    // 「レッスンタイプ」セレクトは1番目（順序が変わらない前提）
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'trial' } });

    // trial レッスンは1件のみ（無料体験レッスン）
    const afterHeadings = screen.getAllByRole('heading', { level: 3 });
    expect(afterHeadings).toHaveLength(1);
    expect(afterHeadings[0]).toHaveTextContent('無料体験レッスン');
  });
});
