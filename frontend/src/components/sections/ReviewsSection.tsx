/**
 * Reviews Section Component
 * 顧客レビュー・評価を表示するセクション
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Container, Card, Badge, Avatar } from '@/components/ui';
import { cn } from '@/utils/cn';

interface Review {
  id: string;
  studentName: string;
  studentInitial?: string;
  avatar?: string;
  rating: number;
  comment: string;
  lessonType: 'group' | 'private' | 'trial';
  submittedAt: Date;
  isPublished: boolean;
  teacherName?: string;
  helpfulCount: number;
  verified: boolean;
  course?: string;
  studyPeriod?: string;
}

const reviews: Review[] = [
  {
    id: '1',
    studentName: '田中 美咲',
    studentInitial: 'M.T',
    rating: 5,
    comment: 'サラ先生のレッスンは本当に楽しくて、毎回通うのが楽しみです！初心者の私でも安心して話せる雰囲気を作ってくれて、3ヶ月で日常会話ができるようになりました。カフェの雰囲気も最高です。',
    lessonType: 'group',
    submittedAt: new Date('2024-01-15'),
    isPublished: true,
    teacherName: 'Sarah Johnson',
    helpfulCount: 24,
    verified: true,
    course: 'グループレッスン',
    studyPeriod: '6ヶ月'
  },
  {
    id: '2',
    studentName: '佐藤 健太',
    studentInitial: 'K.S',
    rating: 5,
    comment: 'ビジネス英語を学びたくてマイケル先生のプライベートレッスンを受講しています。実際のビジネスシーンで使える表現をたくさん教えてもらい、会社でのプレゼンテーションが格段に上達しました。',
    lessonType: 'private',
    submittedAt: new Date('2024-01-10'),
    isPublished: true,
    teacherName: 'Michael Brown',
    helpfulCount: 18,
    verified: true,
    course: 'プライベートレッスン',
    studyPeriod: '4ヶ月'
  },
  {
    id: '3',
    studentName: '山田 花子',
    studentInitial: 'H.Y',
    rating: 4,
    comment: '体験レッスンから始めて、今では毎週通っています。エマ先生は優しくて、間違いを恐れずに話せる環境を作ってくれます。発音も少しずつ良くなってきました！',
    lessonType: 'group',
    submittedAt: new Date('2024-01-08'),
    isPublished: true,
    teacherName: 'Emma Thompson',
    helpfulCount: 15,
    verified: true,
    course: 'グループレッスン',
    studyPeriod: '2ヶ月'
  },
  {
    id: '4',
    studentName: '鈴木 太郎',
    studentInitial: 'T.S',
    rating: 5,
    comment: 'TOEIC対策でお世話になっています。ジェームス先生の指導のおかげで、スコアが200点もアップしました！発音矯正も丁寧で、リスニング力が大幅に向上しました。',
    lessonType: 'private',
    submittedAt: new Date('2024-01-05'),
    isPublished: true,
    teacherName: 'James Wilson',
    helpfulCount: 31,
    verified: true,
    course: 'TOEIC対策コース',
    studyPeriod: '8ヶ月'
  },
  {
    id: '5',
    studentName: '高橋 麻衣',
    studentInitial: 'M.T',
    rating: 5,
    comment: 'カフェの雰囲気がとても良くて、リラックスして学習できます。講師の皆さんはフレンドリーで、英語を話すことへの恐怖心がなくなりました。友達にもおすすめしています！',
    lessonType: 'group',
    submittedAt: new Date('2024-01-03'),
    isPublished: true,
    helpfulCount: 22,
    verified: true,
    course: 'グループレッスン',
    studyPeriod: '5ヶ月'
  },
  {
    id: '6',
    studentName: '中村 雄一',
    studentInitial: 'Y.N',
    rating: 4,
    comment: '仕事で英語が必要になり、急遽通い始めました。短期間でも実用的な英語を身につけることができ、海外出張でも自信を持って話せるようになりました。',
    lessonType: 'private',
    submittedAt: new Date('2023-12-28'),
    isPublished: true,
    teacherName: 'Michael Brown',
    helpfulCount: 19,
    verified: true,
    course: 'ビジネス英語コース',
    studyPeriod: '3ヶ月'
  }
];

interface ReviewsSectionProps {
  className?: string;
  showAll?: boolean;
  maxReviews?: number;
}

export function ReviewsSection({ 
  className, 
  showAll = false, 
  maxReviews = 6 
}: ReviewsSectionProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
  const [displayMode, setDisplayMode] = useState<'grid' | 'carousel'>('grid');
  const sectionRef = useRef<HTMLElement>(null);

  const displayReviews = showAll ? reviews : reviews.slice(0, maxReviews);
  const featuredReviews = reviews.filter(review => review.rating === 5).slice(0, 3);

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

  // カルーセル自動スライド
  useEffect(() => {
    if (displayMode === 'carousel') {
      const interval = setInterval(() => {
        setCurrentReviewIndex((prev) => (prev + 1) % featuredReviews.length);
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [displayMode, featuredReviews.length]);

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <svg
        key={i}
        className={cn(
          'w-5 h-5',
          i < rating ? 'text-yellow-400' : 'text-gray-300'
        )}
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ));
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long'
    });
  };

  const averageRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
  const ratingDistribution = [5, 4, 3, 2, 1].map(rating => ({
    rating,
    count: reviews.filter(r => r.rating === rating).length,
    percentage: (reviews.filter(r => r.rating === rating).length / reviews.length) * 100
  }));

  return (
    <section 
      ref={sectionRef}
      className={cn('py-20 bg-gray-50', className)}
    >
      <Container>
        {/* セクションヘッダー */}
        <div className={cn(
          'text-center mb-16 transform transition-all duration-1000',
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
        )}>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            生徒さんの声
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            実際に通われている生徒さんからの生の声をお聞きください
          </p>

          {/* 評価サマリー */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 mb-8">
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <span className="text-4xl font-bold text-primary-600 mr-2">
                  {averageRating.toFixed(1)}
                </span>
                <div className="flex">
                  {renderStars(Math.round(averageRating))}
                </div>
              </div>
              <p className="text-gray-600">
                {reviews.length}件のレビュー
              </p>
            </div>

            <div className="space-y-2">
              {ratingDistribution.map(({ rating, count, percentage }) => (
                <div key={rating} className="flex items-center gap-2 text-sm">
                  <span className="w-8">{rating}★</span>
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-yellow-400 h-2 rounded-full transition-all duration-1000"
                      style={{ 
                        width: isVisible ? `${percentage}%` : '0%',
                        transitionDelay: `${rating * 200}ms`
                      }}
                    />
                  </div>
                  <span className="w-8 text-gray-600">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 表示モード切り替え */}
          <div className="flex justify-center gap-2 mb-8">
            <button
              onClick={() => setDisplayMode('grid')}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                displayMode === 'grid'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              )}
            >
              グリッド表示
            </button>
            <button
              onClick={() => setDisplayMode('carousel')}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                displayMode === 'carousel'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              )}
            >
              スライド表示
            </button>
          </div>
        </div>

        {/* レビュー表示 */}
        {displayMode === 'grid' ? (
          /* グリッド表示 */
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayReviews.map((review, index) => (
              <Card
                key={review.id}
                className={cn(
                  'p-6 hover:shadow-lg transition-all duration-300 transform hover:scale-105',
                  isVisible 
                    ? 'translate-y-0 opacity-100' 
                    : 'translate-y-8 opacity-0'
                )}
                style={{ transitionDelay: `${index * 150}ms` }}
              >
                {/* レビューヘッダー */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <Avatar
                      name={review.studentName}
                      size="md"
                      className="flex-shrink-0"
                    />
                    <div>
                      <h4 className="font-semibold text-gray-900">
                        {review.studentInitial || review.studentName}
                      </h4>
                      <div className="flex items-center space-x-2 text-sm text-gray-500">
                        <span>{review.course}</span>
                        {review.verified && (
                          <Badge variant="success" size="sm">
                            認証済み
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex">
                    {renderStars(review.rating)}
                  </div>
                </div>

                {/* レビュー内容 */}
                <blockquote className="text-gray-700 mb-4 leading-relaxed">
                  "{review.comment}"
                </blockquote>

                {/* レビュー詳細 */}
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center space-x-4">
                    {review.teacherName && (
                      <span>講師: {review.teacherName}</span>
                    )}
                    <span>受講期間: {review.studyPeriod}</span>
                  </div>
                  <span>{formatDate(review.submittedAt)}</span>
                </div>

                {/* 参考になったボタン */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <button className="flex items-center space-x-2 text-sm text-gray-600 hover:text-primary-600 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L9 7v13m-3-4l-2-2m0 0l-2-2m2 2v6" />
                    </svg>
                    <span>参考になった ({review.helpfulCount})</span>
                  </button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          /* カルーセル表示 */
          <div className="relative max-w-4xl mx-auto">
            <div className="overflow-hidden rounded-2xl">
              <div 
                className="flex transition-transform duration-500 ease-in-out"
                style={{ transform: `translateX(-${currentReviewIndex * 100}%)` }}
              >
                {featuredReviews.map((review, index) => (
                  <div key={review.id} className="w-full flex-shrink-0">
                    <Card className="p-8 mx-4 text-center">
                      <div className="mb-6">
                        <div className="flex justify-center mb-4">
                          {renderStars(review.rating)}
                        </div>
                        <blockquote className="text-xl text-gray-700 leading-relaxed mb-6">
                          "{review.comment}"
                        </blockquote>
                      </div>
                      
                      <div className="flex items-center justify-center space-x-4">
                        <Avatar
                          name={review.studentName}
                          size="lg"
                        />
                        <div className="text-left">
                          <h4 className="font-semibold text-gray-900">
                            {review.studentInitial || review.studentName}
                          </h4>
                          <p className="text-sm text-gray-600">
                            {review.course} • {review.studyPeriod}
                          </p>
                          {review.teacherName && (
                            <p className="text-xs text-gray-500">
                              講師: {review.teacherName}
                            </p>
                          )}
                        </div>
                      </div>
                    </Card>
                  </div>
                ))}
              </div>
            </div>

            {/* カルーセルナビゲーション */}
            <div className="flex justify-center mt-6 space-x-2">
              {featuredReviews.map((_, index) => (
                <button
                  key={index}
                  className={cn(
                    'w-3 h-3 rounded-full transition-all duration-300',
                    currentReviewIndex === index 
                      ? 'bg-primary-600 w-8' 
                      : 'bg-gray-300 hover:bg-gray-400'
                  )}
                  onClick={() => setCurrentReviewIndex(index)}
                />
              ))}
            </div>

            {/* 前後ボタン */}
            <button
              onClick={() => setCurrentReviewIndex((prev) => 
                prev === 0 ? featuredReviews.length - 1 : prev - 1
              )}
              className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-4 bg-white rounded-full p-2 shadow-lg hover:shadow-xl transition-shadow"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => setCurrentReviewIndex((prev) => 
                (prev + 1) % featuredReviews.length
              )}
              className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-4 bg-white rounded-full p-2 shadow-lg hover:shadow-xl transition-shadow"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}

        {/* Google レビューリンク */}
        <div className={cn(
          'text-center mt-12 transform transition-all duration-1000 delay-500',
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
        )}>
          <div className="bg-white rounded-2xl p-6 shadow-sm inline-block">
            <div className="flex items-center justify-center space-x-4 mb-4">
              <Image
                src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg"
                alt="Google"
                width={24}
                height={24}
              />
              <span className="text-lg font-semibold text-gray-900">Google レビュー</span>
              <div className="flex items-center space-x-1">
                <span className="text-lg font-bold text-primary-600">4.8</span>
                <div className="flex">
                  {renderStars(5)}
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Googleでも多くの高評価をいただいています
            </p>
            <a
              href="https://g.page/r/your-google-business-id/review"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-2 text-primary-600 hover:text-primary-700 font-medium"
            >
              <span>Googleレビューを見る</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>
      </Container>
    </section>
  );
}