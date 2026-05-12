/**
 * Services Section Component
 * レッスンタイプ、料金体系、営業時間を表示するセクション
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Container, Card, Button, Badge, Tabs } from '@/components/ui';
import { cn } from '@/utils/cn';

interface LessonType {
  id: string;
  name: string;
  description: string;
  price: {
    amount: number;
    period: string;
  };
  duration: number;
  maxStudents: number;
  features: string[];
  popular?: boolean;
  icon: string;
}

interface BusinessHours {
  day: string;
  hours: string;
  isToday?: boolean;
}

const lessonTypes: LessonType[] = [
  {
    id: 'group',
    name: 'グループレッスン',
    description: '最大4名までの少人数制で、他の生徒と一緒に楽しく学習',
    price: { amount: 3500, period: '1回' },
    duration: 60,
    maxStudents: 4,
    features: [
      '少人数制（最大4名）',
      'ネイティブ講師',
      '教材費込み',
      '振替レッスン可能',
      'レベル別クラス'
    ],
    popular: true,
    icon: '👥'
  },
  {
    id: 'private',
    name: 'プライベートレッスン',
    description: 'マンツーマンで集中的に学習、あなたのペースで進められます',
    price: { amount: 6500, period: '1回' },
    duration: 50,
    maxStudents: 1,
    features: [
      'マンツーマン指導',
      'カスタマイズ可能',
      'フレキシブルスケジュール',
      '専用教材',
      '進捗管理'
    ],
    icon: '🎯'
  },
  {
    id: 'trial',
    name: '体験レッスン',
    description: '初回限定の無料体験レッスンで、雰囲気を体感してください',
    price: { amount: 0, period: '無料' },
    duration: 30,
    maxStudents: 4,
    features: [
      '完全無料',
      'レベルチェック',
      'カウンセリング',
      '入会相談',
      '教材見学'
    ],
    icon: '✨'
  }
];

const businessHours: BusinessHours[] = [
  { day: '月曜日', hours: '10:00 - 21:00' },
  { day: '火曜日', hours: '10:00 - 21:00' },
  { day: '水曜日', hours: '10:00 - 21:00' },
  { day: '木曜日', hours: '10:00 - 21:00' },
  { day: '金曜日', hours: '10:00 - 21:00' },
  { day: '土曜日', hours: '9:00 - 18:00' },
  { day: '日曜日', hours: '定休日' }
];

// 今日の曜日を取得
const getTodayIndex = () => {
  const today = new Date().getDay();
  return today === 0 ? 6 : today - 1; // 日曜日を6に調整
};

interface ServicesSectionProps {
  className?: string;
}

export function ServicesSection({ className }: ServicesSectionProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('lessons');
  const sectionRef = useRef<HTMLElement>(null);
  const todayIndex = getTodayIndex();

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

  const tabItems = [
    {
      id: 'lessons',
      label: 'レッスンタイプ',
      content: (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {lessonTypes.map((lesson, index) => (
            <Card
              key={lesson.id}
              className={cn(
                'relative p-6 transform transition-all duration-700 hover:scale-105',
                lesson.popular && 'ring-2 ring-primary-500 shadow-lg',
                isVisible 
                  ? 'translate-y-0 opacity-100' 
                  : 'translate-y-8 opacity-0'
              )}
              style={{ transitionDelay: `${index * 150}ms` }}
            >
              {lesson.popular && (
                <Badge 
                  variant="primary" 
                  className="absolute -top-3 left-1/2 transform -translate-x-1/2"
                >
                  人気No.1
                </Badge>
              )}
              
              <div className="text-center mb-4">
                <div className="text-4xl mb-3">{lesson.icon}</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {lesson.name}
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {lesson.description}
                </p>
              </div>

              <div className="text-center mb-6">
                <div className="text-3xl font-bold text-primary-600 mb-1">
                  {lesson.price.amount === 0 ? '無料' : `¥${lesson.price.amount.toLocaleString()}`}
                </div>
                <div className="text-sm text-gray-500">
                  {lesson.price.period} / {lesson.duration}分
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  定員: {lesson.maxStudents}名
                </div>
              </div>

              <ul className="space-y-2 mb-6">
                {lesson.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center text-sm text-gray-600">
                    <svg className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              <Button 
                className="w-full" 
                variant={lesson.popular ? 'primary' : 'outline'}
                asChild
              >
                <Link href="/contact">
                  {lesson.id === 'trial' ? '無料体験を予約' : '詳細・予約'}
                </Link>
              </Button>
            </Card>
          ))}
        </div>
      )
    },
    {
      id: 'schedule',
      label: '営業時間',
      content: (
        <div className="max-w-2xl mx-auto">
          <Card className="p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-6 text-center">
              営業時間・スケジュール
            </h3>
            
            <div className="space-y-3">
              {businessHours.map((schedule, index) => (
                <div
                  key={index}
                  className={cn(
                    'flex justify-between items-center py-3 px-4 rounded-lg transition-colors',
                    index === todayIndex 
                      ? 'bg-primary-50 border border-primary-200' 
                      : 'bg-gray-50',
                    schedule.hours === '定休日' && 'opacity-60'
                  )}
                >
                  <span className={cn(
                    'font-medium',
                    index === todayIndex ? 'text-primary-700' : 'text-gray-700'
                  )}>
                    {schedule.day}
                    {index === todayIndex && (
                      <Badge variant="primary" size="sm" className="ml-2">
                        今日
                      </Badge>
                    )}
                  </span>
                  <span className={cn(
                    'font-mono',
                    schedule.hours === '定休日' 
                      ? 'text-red-500' 
                      : index === todayIndex 
                        ? 'text-primary-600 font-semibold' 
                        : 'text-gray-600'
                  )}>
                    {schedule.hours}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">
                📅 予約について
              </h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• レッスンは完全予約制です</li>
                <li>• 前日までのキャンセルで振替可能</li>
                <li>• 祝日は通常営業（年末年始除く）</li>
                <li>• 臨時休業はWebサイトでお知らせします</li>
              </ul>
            </div>

            <div className="mt-6 text-center">
              <Button size="lg" asChild>
                <Link href="/contact">
                  レッスンを予約する
                </Link>
              </Button>
            </div>
          </Card>
        </div>
      )
    },
    {
      id: 'pricing',
      label: '料金プラン',
      content: (
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8">
            {/* 月額プラン */}
            <Card className="p-6">
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  月額プラン
                </h3>
                <p className="text-gray-600 text-sm">
                  定期的に通いたい方におすすめ
                </p>
              </div>

              <div className="space-y-4">
                <div className="border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">月4回プラン</span>
                    <span className="text-lg font-bold text-primary-600">¥12,000</span>
                  </div>
                  <p className="text-sm text-gray-600">1回あたり ¥3,000</p>
                </div>

                <div className="border rounded-lg p-4 ring-2 ring-primary-500">
                  <Badge variant="primary" size="sm" className="mb-2">おすすめ</Badge>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">月8回プラン</span>
                    <span className="text-lg font-bold text-primary-600">¥20,000</span>
                  </div>
                  <p className="text-sm text-gray-600">1回あたり ¥2,500</p>
                </div>

                <div className="border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">通い放題プラン</span>
                    <span className="text-lg font-bold text-primary-600">¥35,000</span>
                  </div>
                  <p className="text-sm text-gray-600">毎日1回まで</p>
                </div>
              </div>
            </Card>

            {/* 都度払い */}
            <Card className="p-6">
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  都度払い
                </h3>
                <p className="text-gray-600 text-sm">
                  自分のペースで通いたい方に
                </p>
              </div>

              <div className="space-y-4">
                <div className="border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">グループレッスン</span>
                    <span className="text-lg font-bold text-primary-600">¥3,500</span>
                  </div>
                  <p className="text-sm text-gray-600">60分 / 最大4名</p>
                </div>

                <div className="border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">プライベートレッスン</span>
                    <span className="text-lg font-bold text-primary-600">¥6,500</span>
                  </div>
                  <p className="text-sm text-gray-600">50分 / マンツーマン</p>
                </div>

                <div className="border rounded-lg p-4 bg-green-50">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">体験レッスン</span>
                    <span className="text-lg font-bold text-green-600">無料</span>
                  </div>
                  <p className="text-sm text-gray-600">30分 / 初回限定</p>
                </div>
              </div>
            </Card>
          </div>

          <div className="mt-8 p-6 bg-gray-50 rounded-lg">
            <h4 className="font-semibold text-gray-900 mb-4 text-center">
              💰 料金に含まれるもの
            </h4>
            <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-600">
              <ul className="space-y-2">
                <li className="flex items-center">
                  <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  教材費
                </li>
                <li className="flex items-center">
                  <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  ドリンク（コーヒー・紅茶）
                </li>
              </ul>
              <ul className="space-y-2">
                <li className="flex items-center">
                  <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Wi-Fi利用
                </li>
                <li className="flex items-center">
                  <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  学習サポート
                </li>
              </ul>
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <section 
      ref={sectionRef}
      className={cn('py-20 bg-gray-50', className)}
    >
      <Container>
        <div className={cn(
          'text-center mb-12 transform transition-all duration-1000',
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
        )}>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            サービス概要
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            あなたに最適な学習スタイルを見つけてください
          </p>
        </div>

        <Tabs
          items={tabItems}
          defaultActiveTab="lessons"
          variant="pills"
          className="max-w-6xl mx-auto"
        />
      </Container>
    </section>
  );
}