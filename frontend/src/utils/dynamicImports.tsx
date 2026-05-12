/**
 * Dynamic Import Utilities
 * 動的インポートのユーティリティ関数
 */

import dynamic from 'next/dynamic';
import { ComponentType } from 'react';
import { SectionSkeleton, CardSkeleton, FormSkeleton } from '@/components/ui/LazyComponent';

// セクションコンポーネントの動的インポート
export const DynamicHeroSection = dynamic(
  () => import('@/components/sections/HeroSection').then(mod => ({ default: mod.HeroSection })),
  {
    loading: () => <SectionSkeleton />,
    ssr: true, // ヒーローセクションはSSRを有効にする
  }
);

export const DynamicFeaturesSection = dynamic(
  () => import('@/components/sections/FeaturesSection').then(mod => ({ default: mod.FeaturesSection })),
  {
    loading: () => <SectionSkeleton />,
    ssr: false, // 下部セクションはクライアントサイドで読み込み
  }
);

export const DynamicServicesSection = dynamic(
  () => import('@/components/sections/ServicesSection').then(mod => ({ default: mod.ServicesSection })),
  {
    loading: () => <SectionSkeleton />,
    ssr: false,
  }
);

export const DynamicTeachersSection = dynamic(
  () => import('@/components/sections/TeachersSection').then(mod => ({ default: mod.TeachersSection })),
  {
    loading: () => <SectionSkeleton />,
    ssr: false,
  }
);

export const DynamicYouTubeVideoSection = dynamic(
  () => import('@/components/sections/YouTubeVideoSection').then(mod => ({ default: mod.YouTubeVideoSection })),
  {
    loading: () => <SectionSkeleton />,
    ssr: false,
  }
);

export const DynamicReviewsSection = dynamic(
  () => import('@/components/sections/ReviewsSection').then(mod => ({ default: mod.ReviewsSection })),
  {
    loading: () => <SectionSkeleton />,
    ssr: false,
  }
);

export const DynamicStatsSection = dynamic(
  () => import('@/components/sections/StatsSection').then(mod => ({ default: mod.StatsSection })),
  {
    loading: () => <SectionSkeleton />,
    ssr: false,
  }
);

export const DynamicCTASection = dynamic(
  () => import('@/components/sections/CTASection').then(mod => ({ default: mod.CTASection })),
  {
    loading: () => <SectionSkeleton />,
    ssr: false,
  }
);

// フォームコンポーネントの動的インポート
export const DynamicContactForm = dynamic(
  () => import('@/components/forms/ContactForm').then(mod => ({ default: mod.ContactForm })),
  {
    loading: () => <FormSkeleton />,
    ssr: false,
  }
);

export const DynamicReviewForm = dynamic(
  () => import('@/components/forms/ReviewForm').then(mod => ({ default: mod.ReviewForm })),
  {
    loading: () => <FormSkeleton />,
    ssr: false,
  }
);

// UI コンポーネントの動的インポート
export const DynamicVideoGallery = dynamic(
  () => import('@/components/ui/VideoGallery').then(mod => ({ default: mod.VideoGallery })),
  {
    loading: () => <SectionSkeleton />,
    ssr: false,
  }
);

export const DynamicVideoCard = dynamic(
  () => import('@/components/ui/VideoCard').then(mod => ({ default: mod.VideoCard })),
  {
    loading: () => <CardSkeleton />,
    ssr: false,
  }
);

// 高階関数：任意のコンポーネントを動的インポート化
export function createDynamicComponent<P extends object>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  options: {
    loading?: () => JSX.Element;
    ssr?: boolean;
  } = {}
) {
  return dynamic(importFn, {
    loading: options.loading || (() => <div>Loading...</div>),
    ssr: options.ssr ?? false,
  });
}

// プリロード関数
export const preloadComponent = (importFn: () => Promise<any>) => {
  if (typeof window !== 'undefined') {
    // ブラウザ環境でのみ実行
    importFn();
  }
};

// 重要なコンポーネントのプリロード
export const preloadCriticalComponents = () => {
  // ユーザーがよくアクセスするコンポーネントを事前読み込み
  preloadComponent(() => import('@/components/forms/ContactForm'));
  preloadComponent(() => import('@/components/sections/TeachersSection'));
  preloadComponent(() => import('@/components/sections/ServicesSection'));
};

// ページ別の動的インポート設定
export const pageComponents = {
  home: {
    hero: DynamicHeroSection,
    features: DynamicFeaturesSection,
    services: DynamicServicesSection,
    teachers: DynamicTeachersSection,
    videos: DynamicYouTubeVideoSection,
    reviews: DynamicReviewsSection,
    stats: DynamicStatsSection,
    cta: DynamicCTASection,
  },
  contact: {
    form: DynamicContactForm,
  },
  videos: {
    gallery: DynamicVideoGallery,
  },
} as const;