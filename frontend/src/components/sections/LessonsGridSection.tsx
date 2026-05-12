/**
 * Lessons Grid Section Component
 * レッスン一覧ページ用のグリッド表示コンポーネント
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Container, Card, Button, Badge, Select } from '@/components/ui';
import { cn } from '@/utils/cn';

interface Lesson {
  id: string;
  title: string;
  titleEnglish: string;
  description: string;
  type: 'group' | 'private' | 'trial' | 'online';
  level: string[];
  price: {
    amount: number;
    currency: 'JPY';
    period: 'per_lesson' | 'monthly' | 'per_hour';
    originalPrice?: number;
  };
  duration: number; // minutes
  maxStudents?: number;
  features: string[];
  image: string;
  popular?: boolean;
  recommended?: boolean;
  schedule: string[];
  benefits: string[];
  targetAudience: string[];
}

// レッスンデータ
const allLessons: Lesson[] = [
  {
    id: 'trial-lesson',
    title: '無料体験レッスン',
    titleEnglish: 'Free Trial Lesson',
    description: '初回限定の無料体験レッスンです。あなたの英語レベルをチェックし、最適な学習プランをご提案します。',
    type: 'trial',
    level: ['初心者', '初級', '中級', '上級'],
    price: {
      amount: 0,
      currency: 'JPY',
      period: 'per_lesson',
      originalPrice: 3000
    },
    duration: 50,
    maxStudents: 1,
    features: ['レベルチェック', '学習プラン提案', '講師との相性確認', 'カフェ見学'],
    image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    popular: true,
    recommended: true,
    schedule: ['平日 10:00-18:00', '土曜 9:00-15:00'],
    benefits: [
      '完全無料でお試し可能',
      '英語レベルの正確な診断',
      '個別学習プランの提案',
      'カフェの雰囲気を体験'
    ],
    targetAudience: ['英会話初心者', 'レベルチェック希望者', 'カフェ見学希望者']
  },
  {
    id: 'group-conversation',
    title: 'グループ英会話',
    titleEnglish: 'Group Conversation',
    description: '最大4名の少人数グループで行う英会話レッスン。他の生徒との交流を通じて、実践的なコミュニケーション力を身につけます。',
    type: 'group',
    level: ['初級', '中級', '上級'],
    price: {
      amount: 2500,
      currency: 'JPY',
      period: 'per_lesson'
    },
    duration: 60,
    maxStudents: 4,
    features: ['少人数制', '実践的会話', '多様なトピック', 'ペアワーク'],
    image: 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    popular: true,
    schedule: ['平日 10:00-21:00', '土曜 9:00-18:00'],
    benefits: [
      '他の生徒との交流',
      'リーズナブルな料金',
      '多様な視点での学習',
      'グループディスカッション'
    ],
    targetAudience: ['英会話初級者', '交流を求める方', 'コスパ重視の方']
  },
  {
    id: 'private-lesson',
    title: 'プライベートレッスン',
    titleEnglish: 'Private Lesson',
    description: '講師と1対1で行う完全個別指導レッスン。あなたの目標や弱点に合わせてカスタマイズされたレッスンを提供します。',
    type: 'private',
    level: ['初心者', '初級', '中級', '上級'],
    price: {
      amount: 5000,
      currency: 'JPY',
      period: 'per_lesson'
    },
    duration: 50,
    maxStudents: 1,
    features: ['完全個別指導', 'カスタマイズレッスン', '集中学習', '柔軟なスケジュール'],
    image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    recommended: true,
    schedule: ['平日 10:00-21:00', '土曜 9:00-18:00', '日曜 10:00-16:00'],
    benefits: [
      '100%あなたに集中',
      '弱点の集中改善',
      '学習ペースの調整',
      '目標に特化した内容'
    ],
    targetAudience: ['集中学習希望者', '特定目標がある方', '上達を急ぐ方']
  },
  {
    id: 'business-english',
    title: 'ビジネス英語',
    titleEnglish: 'Business English',
    description: 'ビジネスシーンで必要な英語スキルを習得するレッスン。プレゼンテーション、会議、交渉など実践的な場面を想定した内容です。',
    type: 'group',
    level: ['中級', '上級'],
    price: {
      amount: 3500,
      currency: 'JPY',
      period: 'per_lesson'
    },
    duration: 75,
    maxStudents: 6,
    features: ['ビジネス特化', 'ロールプレイ', 'プレゼン練習', '実践的内容'],
    image: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    popular: true,
    schedule: ['平日 18:00-21:00', '土曜 13:00-18:00'],
    benefits: [
      'ビジネス英語の習得',
      '実践的なスキル向上',
      'プレゼン能力の向上',
      'ネットワーキング機会'
    ],
    targetAudience: ['ビジネスパーソン', 'キャリアアップ希望者', '転職準備中の方']
  },
  {
    id: 'toeic-preparation',
    title: 'TOEIC対策',
    titleEnglish: 'TOEIC Preparation',
    description: 'TOEIC L&Rテストのスコアアップを目指す集中対策レッスン。効率的な解法テクニックと実践問題で確実にスコアを向上させます。',
    type: 'group',
    level: ['初級', '中級', '上級'],
    price: {
      amount: 3000,
      currency: 'JPY',
      period: 'per_lesson'
    },
    duration: 90,
    maxStudents: 8,
    features: ['スコア保証', '解法テクニック', '模擬試験', '個別フィードバック'],
    image: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    schedule: ['平日 19:00-20:30', '土曜 10:00-11:30', '日曜 14:00-15:30'],
    benefits: [
      'スコアアップ保証',
      '効率的な学習法',
      '豊富な練習問題',
      '定期的な模擬試験'
    ],
    targetAudience: ['就職活動中の方', '昇進・昇格希望者', 'スコアアップ必要な方']
  },
  {
    id: 'online-lesson',
    title: 'オンラインレッスン',
    titleEnglish: 'Online Lesson',
    description: 'ご自宅から参加できるオンライン英会話レッスン。通学時間を節約しながら、質の高いレッスンを受講できます。',
    type: 'online',
    level: ['初心者', '初級', '中級', '上級'],
    price: {
      amount: 2000,
      currency: 'JPY',
      period: 'per_lesson'
    },
    duration: 50,
    maxStudents: 4,
    features: ['自宅受講', '録画復習', 'チャット機能', '画面共有'],
    image: 'https://images.unsplash.com/photo-1588196749597-9ff075ee6b5b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    schedule: ['毎日 8:00-22:00'],
    benefits: [
      '通学時間不要',
      'リーズナブルな料金',
      'レッスン録画で復習',
      '柔軟なスケジュール'
    ],
    targetAudience: ['忙しい方', '遠方にお住まいの方', '自宅学習希望者']
  }
];

const lessonTypes = [
  { value: 'all', label: '全てのレッスン' },
  { value: 'trial', label: '体験レッスン' },
  { value: 'group', label: 'グループレッスン' },
  { value: 'private', label: 'プライベートレッスン' },
  { value: 'online', label: 'オンラインレッスン' }
];

const levels = [
  { value: 'all', label: '全レベル' },
  { value: '初心者', label: '初心者' },
  { value: '初級', label: '初級' },
  { value: '中級', label: '中級' },
  { value: '上級', label: '上級' }
];

const priceRanges = [
  { value: 'all', label: '全ての料金' },
  { value: 'free', label: '無料' },
  { value: 'low', label: '3,000円以下' },
  { value: 'mid', label: '3,001円〜4,000円' },
  { value: 'high', label: '4,001円以上' }
];

interface LessonsGridSectionProps {
  className?: string;
}

export function LessonsGridSection({ className }: LessonsGridSectionProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [filteredLessons, setFilteredLessons] = useState(allLessons);
  const [selectedType, setSelectedType] = useState('all');
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [selectedPriceRange, setSelectedPriceRange] = useState('all');
  const [sortBy, setSortBy] = useState('recommended');
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

  // フィルタリングとソート
  useEffect(() => {
    let filtered = allLessons.filter(lesson => {
      const matchesType = selectedType === 'all' || lesson.type === selectedType;
      const matchesLevel = selectedLevel === 'all' || lesson.level.includes(selectedLevel);
      
      let matchesPrice = true;
      if (selectedPriceRange !== 'all') {
        const price = lesson.price.amount;
        switch (selectedPriceRange) {
          case 'free':
            matchesPrice = price === 0;
            break;
          case 'low':
            matchesPrice = price > 0 && price <= 3000;
            break;
          case 'mid':
            matchesPrice = price > 3000 && price <= 4000;
            break;
          case 'high':
            matchesPrice = price > 4000;
            break;
        }
      }

      return matchesType && matchesLevel && matchesPrice;
    });

    // ソート
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'recommended':
          if (a.recommended && !b.recommended) return -1;
          if (!a.recommended && b.recommended) return 1;
          if (a.popular && !b.popular) return -1;
          if (!a.popular && b.popular) return 1;
          return 0;
        case 'price_low':
          return a.price.amount - b.price.amount;
        case 'price_high':
          return b.price.amount - a.price.amount;
        case 'duration':
          return b.duration - a.duration;
        default:
          return 0;
      }
    });

    setFilteredLessons(filtered);
  }, [selectedType, selectedLevel, selectedPriceRange, sortBy]);

  const formatPrice = (lesson: Lesson) => {
    if (lesson.price.amount === 0) {
      return '無料';
    }
    
    const periodText = {
      'per_lesson': '/回',
      'monthly': '/月',
      'per_hour': '/時間'
    };

    return `¥${lesson.price.amount.toLocaleString()}${periodText[lesson.price.period]}`;
  };

  const getTypeLabel = (type: string) => {
    const typeLabels = {
      'trial': '体験',
      'group': 'グループ',
      'private': 'プライベート',
      'online': 'オンライン'
    };
    return typeLabels[type as keyof typeof typeLabels] || type;
  };

  const getTypeBadgeVariant = (type: string) => {
    const variants = {
      'trial': 'success' as const,
      'group': 'primary' as const,
      'private': 'warning' as const,
      'online': 'info' as const
    };
    return variants[type as keyof typeof variants] || 'default' as const;
  };

  return (
    <section 
      ref={sectionRef}
      className={cn('py-20 bg-gray-50', className)}
    >
      <Container>
        {/* フィルター・ソートエリア */}
        <div className={cn(
          'bg-white rounded-2xl p-6 shadow-sm mb-12 transform transition-all duration-1000',
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
        )}>
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Select
              options={lessonTypes}
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              placeholder="レッスンタイプ"
            />
            
            <Select
              options={levels}
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              placeholder="レベル"
            />
            
            <Select
              options={priceRanges}
              value={selectedPriceRange}
              onChange={(e) => setSelectedPriceRange(e.target.value)}
              placeholder="料金"
            />
            
            <Select
              options={[
                { value: 'recommended', label: 'おすすめ順' },
                { value: 'price_low', label: '料金安い順' },
                { value: 'price_high', label: '料金高い順' },
                { value: 'duration', label: '時間長い順' }
              ]}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              placeholder="並び順"
            />
            
            <div className="flex items-center justify-center">
              <span className="text-sm text-gray-600">
                {filteredLessons.length}件のレッスン
              </span>
            </div>
          </div>
        </div>

        {/* レッスングリッド */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredLessons.map((lesson, index) => (
            <Card
              key={lesson.id}
              className={cn(
                'overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:scale-105',
                lesson.recommended && 'ring-2 ring-primary-500',
                lesson.popular && 'ring-2 ring-yellow-400',
                isVisible 
                  ? 'translate-y-0 opacity-100' 
                  : 'translate-y-8 opacity-0'
              )}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              {/* バッジ */}
              <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                {lesson.recommended && (
                  <Badge variant="primary">
                    おすすめ
                  </Badge>
                )}
                {lesson.popular && (
                  <Badge variant="warning">
                    人気
                  </Badge>
                )}
                <Badge variant={getTypeBadgeVariant(lesson.type)}>
                  {getTypeLabel(lesson.type)}
                </Badge>
              </div>

              {/* 料金バッジ */}
              <div className="absolute top-4 right-4 z-10">
                <div className="bg-white/95 backdrop-blur-sm rounded-lg px-3 py-2">
                  <div className="text-lg font-bold text-gray-900">
                    {formatPrice(lesson)}
                  </div>
                  {lesson.price.originalPrice && (
                    <div className="text-xs text-gray-500 line-through">
                      ¥{lesson.price.originalPrice.toLocaleString()}
                    </div>
                  )}
                </div>
              </div>

              {/* レッスン画像 */}
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src={lesson.image}
                  alt={`${lesson.title}のイメージ`}
                  fill
                  className="object-cover transition-transform duration-300 hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                
                {/* 時間・人数情報 */}
                <div className="absolute bottom-4 left-4 text-white">
                  <div className="flex items-center space-x-4 text-sm">
                    <span className="flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                      </svg>
                      {lesson.duration}分
                    </span>
                    {lesson.maxStudents && (
                      <span className="flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                        </svg>
                        最大{lesson.maxStudents}名
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* レッスン情報 */}
              <div className="p-6">
                <div className="mb-4">
                  <h3 className="text-xl font-bold text-gray-900 mb-1">
                    {lesson.title}
                  </h3>
                  <p className="text-sm text-gray-500 mb-3">
                    {lesson.titleEnglish}
                  </p>
                  
                  <div className="flex flex-wrap gap-1 mb-3">
                    {lesson.level.map((level, idx) => (
                      <Badge key={idx} variant="default" size="sm">
                        {level}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                <p className="text-sm text-gray-600 line-clamp-3 mb-4">
                  {lesson.description}
                </p>

                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">特徴</h4>
                  <div className="flex flex-wrap gap-1">
                    {lesson.features.slice(0, 3).map((feature, idx) => (
                      <span key={idx} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                        {feature}
                      </span>
                    ))}
                    {lesson.features.length > 3 && (
                      <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                        +{lesson.features.length - 3}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    asChild
                  >
                    <Link href={`/lessons/${lesson.id}`}>
                      詳細
                    </Link>
                  </Button>
                  <Button 
                    size="sm" 
                    className="flex-1"
                    asChild
                  >
                    <Link href="/contact">
                      {lesson.type === 'trial' ? '無料体験予約' : 'レッスン予約'}
                    </Link>
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* 結果が見つからない場合 */}
        {filteredLessons.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📚</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              条件に合うレッスンが見つかりませんでした
            </h3>
            <p className="text-gray-600 mb-6">
              フィルター条件を変更してもう一度お試しください
            </p>
            <Button 
              variant="outline"
              onClick={() => {
                setSelectedType('all');
                setSelectedLevel('all');
                setSelectedPriceRange('all');
              }}
            >
              フィルターをリセット
            </Button>
          </div>
        )}
      </Container>
    </section>
  );
}