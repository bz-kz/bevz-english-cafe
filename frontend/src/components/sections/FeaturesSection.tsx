/**
 * Features Section Component
 * 英会話カフェの特徴・メリットを表示するセクション
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Container, Card } from '@/components/ui';
import { cn } from '@/utils/cn';

interface Feature {
  icon: string;
  title: string;
  description: string;
  details: string[];
  image?: string;
}

const features: Feature[] = [
  {
    icon: '🌟',
    title: 'ネイティブ講師による指導',
    description: '経験豊富なネイティブスピーカーが、自然な英語表現と発音を丁寧に指導します。',
    details: [
      'アメリカ、イギリス、カナダ、オーストラリア出身',
      '平均5年以上の指導経験',
      'TESOL・TEFL資格保有者多数',
      '日本語サポートも可能'
    ],
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
  },
  {
    icon: '☕',
    title: 'リラックスしたカフェ環境',
    description: 'コーヒーの香りに包まれた温かい雰囲気で、緊張せずに英会話を楽しめます。',
    details: [
      '落ち着いた店内デザイン',
      '無料のコーヒー・紅茶',
      '快適な学習スペース',
      'Wi-Fi完備'
    ],
    image: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
  },
  {
    icon: '👥',
    title: '少人数制クラス',
    description: '最大4名までの少人数制で、一人ひとりに合わせた丁寧な指導を実現しています。',
    details: [
      '発言機会が豊富',
      '個別フィードバック',
      'レベル別クラス編成',
      'アットホームな雰囲気'
    ],
    image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
  },
  {
    icon: '📈',
    title: '実践重視のカリキュラム',
    description: '日常生活やビジネスで実際に使える実用的な英語力の習得を重視しています。',
    details: [
      '実生活に即したトピック',
      'ロールプレイング中心',
      '文法より会話重視',
      '継続的な進捗管理'
    ],
    image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
  }
];

const benefits = [
  {
    icon: '🎯',
    title: '目標達成サポート',
    description: '個人の目標に合わせたカスタマイズされた学習プランを提供'
  },
  {
    icon: '🔄',
    title: 'フレキシブルスケジュール',
    description: 'あなたのライフスタイルに合わせて柔軟にレッスン時間を調整'
  },
  {
    icon: '💬',
    title: '実践的な会話練習',
    description: '日常会話からビジネス英語まで、実際の場面を想定した練習'
  },
  {
    icon: '📚',
    title: '豊富な学習リソース',
    description: 'オリジナル教材と多様な学習ツールで効果的な学習をサポート'
  },
  {
    icon: '🌍',
    title: '国際的な視野',
    description: '様々な国の文化や習慣も学べる国際的な学習環境'
  },
  {
    icon: '🏆',
    title: '成果の見える化',
    description: '定期的な評価とフィードバックで上達を実感できる'
  }
];

interface FeaturesSectionProps {
  className?: string;
}

export function FeaturesSection({ className }: FeaturesSectionProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // 自動スライド
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % features.length);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <section 
      ref={sectionRef}
      className={cn('py-20 bg-white', className)}
    >
      <Container>
        {/* セクションヘッダー */}
        <div className={cn(
          'text-center mb-16 transform transition-all duration-1000',
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
        )}>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            英会話カフェの特徴
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            私たちが選ばれる理由と、あなたが得られるメリット
          </p>
        </div>

        {/* メイン特徴セクション */}
        <div className="grid lg:grid-cols-2 gap-12 items-center mb-20">
          {/* 特徴リスト */}
          <div className="space-y-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className={cn(
                  'p-6 rounded-lg cursor-pointer transition-all duration-300 transform',
                  activeFeature === index 
                    ? 'bg-primary-50 border-l-4 border-primary-500 shadow-md scale-105' 
                    : 'bg-gray-50 hover:bg-gray-100',
                  isVisible 
                    ? 'translate-x-0 opacity-100' 
                    : 'translate-x-8 opacity-0'
                )}
                style={{ transitionDelay: `${index * 150}ms` }}
                onClick={() => setActiveFeature(index)}
              >
                <div className="flex items-start space-x-4">
                  <div className="text-3xl">{feature.icon}</div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-gray-600 mb-3">
                      {feature.description}
                    </p>
                    
                    {activeFeature === index && (
                      <ul className="space-y-1 text-sm text-gray-500">
                        {feature.details.map((detail, idx) => (
                          <li key={idx} className="flex items-center">
                            <svg className="w-3 h-3 text-primary-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            {detail}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 画像エリア */}
          <div className={cn(
            'relative transform transition-all duration-1000 delay-300',
            isVisible ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'
          )}>
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl">
              {features[activeFeature].image && (
                <Image
                  src={features[activeFeature].image}
                  alt={features[activeFeature].title}
                  fill
                  className="object-cover transition-all duration-500"
                />
              )}
              
              {/* オーバーレイ */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
              
              {/* 画像上のテキスト */}
              <div className="absolute bottom-6 left-6 right-6 text-white">
                <h4 className="text-xl font-bold mb-2">
                  {features[activeFeature].title}
                </h4>
                <p className="text-sm opacity-90">
                  {features[activeFeature].description}
                </p>
              </div>
            </div>

            {/* インジケーター */}
            <div className="flex justify-center mt-6 space-x-2">
              {features.map((_, index) => (
                <button
                  key={index}
                  className={cn(
                    'w-3 h-3 rounded-full transition-all duration-300',
                    activeFeature === index 
                      ? 'bg-primary-600 w-8' 
                      : 'bg-gray-300 hover:bg-gray-400'
                  )}
                  onClick={() => setActiveFeature(index)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* カフェ紹介動画セクション */}
        <div className={cn(
          'mb-20 transform transition-all duration-1000 delay-400',
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
        )}>
          <div className="text-center mb-12">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              カフェの雰囲気を動画でご覧ください
            </h3>
            <p className="text-gray-600 max-w-2xl mx-auto">
              温かみのある店内で、リラックスしながら英語を学べる環境をご紹介します
            </p>
          </div>
          
          <div className="max-w-4xl mx-auto">
            <div className="aspect-video rounded-2xl overflow-hidden shadow-2xl">
              <iframe
                src="https://www.youtube.com/embed/LXb3EKWsInQ?autoplay=0&controls=1"
                title="英会話カフェ店内ツアー"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
            <div className="text-center mt-6">
              <p className="text-sm text-gray-500 mb-4">
                実際の店内の様子や学習環境をご覧いただけます
              </p>
              <a
                href="/videos"
                className="inline-flex items-center text-primary-600 hover:text-primary-700 font-medium"
              >
                他の動画も見る
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        {/* メリットグリッド */}
        <div className={cn(
          'transform transition-all duration-1000 delay-500',
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
        )}>
          <h3 className="text-2xl font-bold text-gray-900 text-center mb-12">
            あなたが得られるメリット
          </h3>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefits.map((benefit, index) => (
              <div
                key={index}
                className={cn(
                  'bg-white rounded-lg shadow-md p-6 text-center hover:shadow-lg transition-all duration-300 transform hover:scale-105',
                  isVisible 
                    ? 'translate-y-0 opacity-100' 
                    : 'translate-y-8 opacity-0'
                )}
                style={{ transitionDelay: `${600 + index * 100}ms` }}
              >
                <div className="text-3xl mb-4">{benefit.icon}</div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3">
                  {benefit.title}
                </h4>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {benefit.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}