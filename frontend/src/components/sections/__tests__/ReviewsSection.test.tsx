/**
 * ReviewsSection Component Smoke Tests
 * 生徒レビューセクションのスモークテスト
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { ReviewsSection } from '../ReviewsSection';

// next/image を最小限モック（fill 等の非DOM属性は除外）
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, src }: { alt: string; src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img alt={alt} src={typeof src === 'string' ? src : ''} />
  ),
}));

describe('ReviewsSection (smoke)', () => {
  it('renders the section heading without throwing', () => {
    render(<ReviewsSection />);
    expect(
      screen.getByRole('heading', { name: '生徒さんの声' })
    ).toBeInTheDocument();
  });

  it('renders 6 review cards by default (maxReviews=6)', () => {
    render(<ReviewsSection />);
    // 各レビューカードは引用要素 blockquote を1つ持つ
    const quotes = screen.getAllByText(
      (_, node) => node?.tagName === 'BLOCKQUOTE'
    );
    expect(quotes).toHaveLength(6);
  });

  it('toggles display mode when clicking the carousel button', () => {
    render(<ReviewsSection />);

    // 切替前は「スライド表示」ボタンが存在
    const carouselBtn = screen.getByRole('button', { name: 'スライド表示' });
    fireEvent.click(carouselBtn);

    // カルーセル切替後はフィーチャー（rating=5）の3件のみ表示
    const quotesAfter = screen.getAllByText(
      (_, node) => node?.tagName === 'BLOCKQUOTE'
    );
    expect(quotesAfter).toHaveLength(3);
  });
});
