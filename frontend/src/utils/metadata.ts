/**
 * SEO Metadata Utilities
 * SEO最適化のためのメタデータユーティリティ
 */

import { Metadata } from 'next';

// サイト基本情報
export const SITE_CONFIG = {
  name: '英会話カフェ',
  description: '東京の英会話カフェで、ネイティブ講師と楽しく英会話を学びませんか？初心者から上級者まで、あなたのレベルに合わせたレッスンを提供します。',
  url: 'https://english-cafe.com', // 実際のドメインに変更
  ogImage: '/og-image.jpg',
  keywords: [
    '英会話',
    'カフェ',
    'ネイティブ講師',
    '東京',
    '英語学習',
    'レッスン',
    '初心者',
    'ビジネス英語',
    'TOEIC',
    '体験レッスン'
  ],
  author: '英会話カフェ',
  creator: '英会話カフェ',
  publisher: '英会話カフェ',
  locale: 'ja_JP',
  type: 'website'
} as const;

// 構造化データ（JSON-LD）
export const generateOrganizationSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'EducationalOrganization',
  name: SITE_CONFIG.name,
  description: SITE_CONFIG.description,
  url: SITE_CONFIG.url,
  logo: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
  image: `${SITE_CONFIG.url}${SITE_CONFIG.ogImage}`,
  address: {
    '@type': 'PostalAddress',
    streetAddress: '神宮前1-2-3 英会話カフェビル 2F',
    addressLocality: '渋谷区',
    addressRegion: '東京都',
    postalCode: '150-0001',
    addressCountry: 'JP'
  },
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: '+81-3-1234-5678',
    contactType: 'customer service',
    availableLanguage: ['Japanese', 'English']
  },
  openingHours: [
    'Mo-Fr 10:00-22:00',
    'Sa-Su 10:00-20:00'
  ],
  priceRange: '¥2500-¥5000',
  paymentAccepted: ['Cash', 'Credit Card'],
  currenciesAccepted: 'JPY'
});

export const generateLocalBusinessSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  '@id': `${SITE_CONFIG.url}#organization`,
  name: SITE_CONFIG.name,
  description: SITE_CONFIG.description,
  url: SITE_CONFIG.url,
  telephone: '+81-3-1234-5678',
  email: 'info@english-cafe.com',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '神宮前1-2-3 英会話カフェビル 2F',
    addressLocality: '渋谷区',
    addressRegion: '東京都',
    postalCode: '150-0001',
    addressCountry: 'JP'
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 35.6762,
    longitude: 139.7623
  },
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      opens: '10:00',
      closes: '22:00'
    },
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Saturday', 'Sunday'],
      opens: '10:00',
      closes: '20:00'
    }
  ],
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    reviewCount: '127',
    bestRating: '5',
    worstRating: '1'
  },
  review: [
    {
      '@type': 'Review',
      author: {
        '@type': 'Person',
        name: 'M.T'
      },
      reviewRating: {
        '@type': 'Rating',
        ratingValue: '5',
        bestRating: '5'
      },
      reviewBody: 'サラ先生のレッスンは本当に楽しくて、毎回通うのが楽しみです！初心者の私でも安心して話せる雰囲気を作ってくれて、3ヶ月で日常会話ができるようになりました。'
    }
  ]
});

// ページ別メタデータ生成
export const generatePageMetadata = (
  title: string,
  description: string,
  path: string = '',
  image?: string,
  keywords?: string[]
): Metadata => {
  const fullTitle = `${title} | ${SITE_CONFIG.name}`;
  const url = `${SITE_CONFIG.url}${path}`;
  const ogImage = image || SITE_CONFIG.ogImage;
  const allKeywords = [...SITE_CONFIG.keywords, ...(keywords || [])];

  return {
    title: fullTitle,
    description,
    keywords: allKeywords.join(', '),
    authors: [{ name: SITE_CONFIG.author }],
    creator: SITE_CONFIG.creator,
    publisher: SITE_CONFIG.publisher,
    metadataBase: new URL(SITE_CONFIG.url),
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: SITE_CONFIG.name,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      locale: SITE_CONFIG.locale,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [ogImage],
      creator: '@english_cafe_tokyo', // 実際のTwitterアカウントに変更
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    verification: {
      google: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION || 'your-google-verification-code',
      // yandex: process.env.NEXT_PUBLIC_YANDEX_VERIFICATION,
      // yahoo: process.env.NEXT_PUBLIC_YAHOO_VERIFICATION,
    },
  };
};

// 講師ページ用メタデータ
export const generateInstructorMetadata = (
  instructor: {
    name: string;
    nameJapanese: string;
    nationality: string;
    specialization: string[];
    experience: string;
    introduction: string;
  },
  instructorId: string
): Metadata => {
  const title = `${instructor.name}（${instructor.nameJapanese}）| 講師紹介`;
  const description = `${instructor.nationality}出身の${instructor.name}講師のプロフィール。${instructor.specialization.join('、')}が専門。経験${instructor.experience}の実績豊富な講師です。${instructor.introduction.slice(0, 100)}...`;
  
  return generatePageMetadata(
    title,
    description,
    `/instructors/${instructorId}`,
    `/instructors/${instructorId}/og-image.jpg`,
    [...instructor.specialization, instructor.nationality, '講師', '英会話講師']
  );
};

// レッスンページ用メタデータ
export const generateLessonMetadata = (
  lesson: {
    title: string;
    description: string;
    type: string;
    price: { amount: number; currency: string; period: string };
    duration: number;
    level: string[];
  },
  lessonId: string
): Metadata => {
  const formatPrice = () => {
    if (lesson.price.amount === 0) return '無料';
    const periodText = {
      'per_lesson': '/回',
      'monthly': '/月',
      'per_hour': '/時間'
    } as const;
    return `¥${lesson.price.amount.toLocaleString()}${periodText[lesson.price.period as keyof typeof periodText]}`;
  };

  const title = `${lesson.title} | レッスン詳細`;
  const description = `${lesson.description} ${formatPrice()}で受講可能。${lesson.duration}分のレッスンで効果的に英語力を向上させます。対象レベル: ${lesson.level.join('、')}`;
  
  return generatePageMetadata(
    title,
    description,
    `/lessons/${lessonId}`,
    `/lessons/${lessonId}/og-image.jpg`,
    [lesson.type, ...lesson.level, 'レッスン', '英会話レッスン', formatPrice()]
  );
};

// 構造化データをJSON文字列として生成する関数
export function generateStructuredDataScript(data: object): string {
  return JSON.stringify(data, null, 2);
}