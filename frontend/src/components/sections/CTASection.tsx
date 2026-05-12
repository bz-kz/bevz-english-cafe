/**
 * CTA Section Component
 * Call to Action セクション
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button, Container } from '@/components/ui';
import { cn } from '@/utils/cn';

interface CTASectionProps {
  className?: string;
  variant?: 'primary' | 'secondary' | 'gradient';
  title?: string;
  description?: string;
  primaryButtonText?: string;
  primaryButtonHref?: string;
  secondaryButtonText?: string;
  secondaryButtonHref?: string;
  showImage?: boolean;
}

export function CTASection({
  className,
  variant = 'gradient',
  title = '今すぐ英会話を始めませんか？',
  description = '無料体験レッスンで、あなたの英語学習の第一歩を踏み出しましょう。経験豊富なネイティブ講師が、あなたのレベルに合わせて丁寧にサポートします。',
  primaryButtonText = '無料体験レッスンを予約',
  primaryButtonHref = '/contact',
  secondaryButtonText = 'レッスン詳細を見る',
  secondaryButtonHref = '/lessons',
  showImage = true
}: CTASectionProps) {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const getVariantClasses = () => {
    switch (variant) {
      case 'primary':
        return 'bg-primary-600 text-white';
      case 'secondary':
        return 'bg-gray-50 text-gray-900';
      case 'gradient':
        return 'bg-gradient-to-r from-primary-600 via-primary-700 to-secondary-600 text-white';
      default:
        return 'bg-gradient-to-r from-primary-600 via-primary-700 to-secondary-600 text-white';
    }
  };

  return (
    <section 
      ref={sectionRef}
      className={cn('relative py-20 overflow-hidden', getVariantClasses(), className)}
    >
      {/* 背景装飾 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-white/5 rounded-full" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full h-full">
          <div className="absolute top-1/4 right-1/4 w-2 h-2 bg-white/30 rounded-full animate-pulse" />
          <div className="absolute bottom-1/3 left-1/3 w-1 h-1 bg-white/40 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/3 left-1/4 w-1.5 h-1.5 bg-white/20 rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
        </div>
      </div>

      <Container className="relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* コンテンツ */}
          <div className={cn(
            'text-center lg:text-left transform transition-all duration-1000',
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
          )}>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 leading-tight">
              {title}
            </h2>
            
            <p className="text-lg md:text-xl mb-8 leading-relaxed opacity-90">
              {description}
            </p>

            {/* ボタン */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-8">
              <Button 
                size="lg" 
                variant={variant === 'secondary' ? 'primary' : 'secondary'}
                className={cn(
                  'text-lg px-8 py-4',
                  variant === 'secondary' 
                    ? 'bg-primary-600 text-white hover:bg-primary-700' 
                    : 'bg-white text-primary-600 hover:bg-gray-50'
                )}
                asChild
              >
                <Link href={primaryButtonHref}>
                  {primaryButtonText}
                </Link>
              </Button>
              
              <Button 
                variant="outline" 
                size="lg" 
                className={cn(
                  'text-lg px-8 py-4',
                  variant === 'secondary'
                    ? 'border-gray-300 text-gray-700 hover:bg-gray-100'
                    : 'border-white/30 text-white hover:bg-white/10'
                )}
                asChild
              >
                <Link href={secondaryButtonHref}>
                  {secondaryButtonText}
                </Link>
              </Button>
            </div>

            {/* 特典情報 */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 text-sm opacity-80">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>入会金無料</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>教材費込み</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>いつでも退会OK</span>
              </div>
            </div>
          </div>

          {/* 画像 */}
          {showImage && (
            <div className={cn(
              'relative transform transition-all duration-1000 delay-300',
              isVisible ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'
            )}>
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl">
                <Image
                  src="https://images.unsplash.com/photo-1556761175-b413da4baf72?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
                  alt="英会話レッスンを楽しむ生徒たち"
                  fill
                  className="object-cover"
                />
                
                {/* オーバーレイ */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                
                {/* 浮遊する要素 */}
                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span>レッスン中</span>
                  </div>
                </div>
              </div>

              {/* 装飾要素 */}
              <div className="absolute -top-6 -left-6 w-24 h-24 bg-white/20 rounded-full" />
              <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-white/10 rounded-full" />
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}