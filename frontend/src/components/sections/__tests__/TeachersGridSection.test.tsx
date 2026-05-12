/**
 * TeachersGridSection Component Smoke Tests
 * 講師一覧グリッドのスモークテスト
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { TeachersGridSection } from '../TeachersGridSection';
import { teachers } from '@/data/teachers';

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

describe('TeachersGridSection (smoke)', () => {
  it('renders without throwing and shows the teacher count', () => {
    render(<TeachersGridSection />);
    // 共有データ（Stage B4）から 6 名
    expect(teachers).toHaveLength(6);
    expect(
      screen.getByText(`${teachers.length}名の講師が見つかりました`)
    ).toBeInTheDocument();
  });

  it('renders all 6 teacher cards by default', () => {
    render(<TeachersGridSection />);
    // 各カードに講師名の h3 がひとつ
    const headings = screen.getAllByRole('heading', { level: 3 });
    expect(headings).toHaveLength(6);
  });

  it('filters the grid when changing the nationality select', () => {
    render(<TeachersGridSection />);
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(6);

    // 国籍 select（1番目の Select、検索 input の次）を 'イギリス' に変更
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'イギリス' } });

    const expectedCount = teachers.filter(
      t => t.nationality === 'イギリス'
    ).length;
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(
      expectedCount
    );
  });
});
