/**
 * Hero Section Component
 * メインページのヒーローセクション
 */

'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button, Container } from '@/components/ui';
import { cn } from '@/utils/cn';
import { RELIABLE_IMAGES } from '@/constants/images';

interface HeroSectionProps {
  className?: string;
}

const heroImages = [
  {
    src: '/images/hero/cafe-interior-1.jpg',
    alt: '英会話カフェの温かい雰囲気の店内',
    fallback: RELIABLE_IMAGES.cafe_atmosphere
  },
  {
    src: '/images/hero/lesson-scene-1.jpg',
    alt: 'ネイティブ講師との楽しいレッスン風景',
    fallback: RELIABLE_IMAGES.lesson_scene
  },
  {
    src: '/images/hero/students-conversation.jpg',
    alt: '生徒同士の英会話練習',
    fallback: RELIABLE_IMAGES.students_conversation
  }
];

const features = [
  {
    icon: '🌟',
    title: 'ネイティブ講師',
    description: '経験豊富なネイティブスピーカーが指導'
  },
  {
    icon: '☕',
    title: 'カフェスタイル',
    description: 'リラックスした雰囲気で自然な英会話'
  },
  {
    icon: '👥',
    title: '少人数制',
    description: '一人ひとりに合わせた丁寧な指導'
  },
  {
    icon: '📈',
    title: '実践重視',
    description: '日常で使える実用的な英語力を習得'
  }
];

export function HeroSection({ className }: HeroSectionProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  // 画像のスライドショー
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % heroImages.length);
    }, 5000); // 5秒ごとに切り替え

    return () => clearInterval(interval);
  }, []);

  // 初期ロード完了
  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section className={cn('relative overflow-hidden bg-gradient-to-br from-primary-50 to-white', className)}>
      {/* 背景画像 */}
      <div className="absolute inset-0 z-0">
        {heroImages.map((image, index) => (
          <div
            key={index}
            className={cn(
              'absolute inset-0 transition-opacity duration-1000',
              index === currentImageIndex ? 'opacity-30' : 'opacity-0'
            )}
          >
            <Image
              src={image.fallback} // 本番では image.src を使用
              alt={image.alt}
              fill
              className="object-cover"
              priority={index === 0}
              onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                // フォールバック画像に切り替え
                const target = e.target as HTMLImageElement;
                target.src = image.fallback;
              }}
            />
          </div>
        ))}
        {/* オーバーレイ */}
        <div className="absolute inset-0 bg-white/70" />
      </div>

      <Container className="relative z-10">
        <div className="py-20 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* メインコンテンツ */}
            <div className={cn(
              'text-center lg:text-left transform transition-all duration-1000',
              isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
            )}>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                <span className="block">英会話を</span>
                <span className="block text-primary-600">もっと身近に</span>
                <span className="block">もっと楽しく</span>
              </h1>

              <p className="text-lg md:text-xl text-gray-600 mb-8 leading-relaxed">
                ネイティブ講師とのカジュアルな会話で、
                <br className="hidden sm:block" />
                自然な英語力を身につけませんか？
                <br className="hidden sm:block" />
                初心者から上級者まで、あなたのペースで学べます。
              </p>

              {/* CTA ボタン */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-12">
                <Button
                  size="lg"
                  className="text-lg px-8 py-4"
                  asChild
                >
                  <Link href="/contact">
                    無料体験レッスンを予約
                  </Link>
                </Button>

                <Button
                  variant="outline"
                  size="lg"
                  className="text-lg px-8 py-4"
                  asChild
                >
                  <Link href="/lessons">
                    レッスン詳細を見る
                  </Link>
                </Button>
              </div>

              {/* 特徴 */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {features.map((feature, index) => (
                  <div
                    key={index}
                    className={cn(
                      'text-center p-4 rounded-lg bg-white/80 backdrop-blur-sm shadow-sm transform transition-all duration-700',
                      isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
                    )}
                    style={{ transitionDelay: `${index * 100 + 300}ms` }}
                  >
                    <div className="text-2xl mb-2">{feature.icon}</div>
                    <h3 className="font-semibold text-gray-900 text-sm mb-1">
                      {feature.title}
                    </h3>
                    <p className="text-xs text-gray-600 leading-tight">
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* サイド画像/動画エリア */}
            <div className={cn(
              'relative transform transition-all duration-1000 delay-500',
              isLoaded ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'
            )}>
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl">
                <Image
                  src="https://images.unsplash.com/photo-1521737604893-d14cc237f11d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
                  alt="英会話カフェでの楽しいレッスン風景"
                  fill
                  className="object-cover"
                  priority
                />

                {/* 再生ボタンオーバーレイ（将来のYouTube動画用） */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors cursor-pointer group">
                  <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6 text-primary-600 ml-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* 装飾要素 */}
              <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary-100 rounded-full opacity-60" />
              <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-secondary-100 rounded-full opacity-40" />
            </div>
          </div>
        </div>
      </Container>

      {/* スクロールインジケーター */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10">
        <div className="flex flex-col items-center text-gray-600 animate-bounce">
          <span className="text-sm mb-2">もっと見る</span>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </div>

      {/* 画像インジケーター */}
      <div className="absolute bottom-20 right-8 z-10 flex space-x-2">
        {heroImages.map((_, index) => (
          <button
            key={index}
            className={cn(
              'w-2 h-2 rounded-full transition-all duration-300',
              index === currentImageIndex
                ? 'bg-primary-600 w-8'
                : 'bg-white/60 hover:bg-white/80'
            )}
            onClick={() => setCurrentImageIndex(index)}
            aria-label={`画像 ${index + 1} を表示`}
          />
        ))}
      </div>
    </section>
  );
}