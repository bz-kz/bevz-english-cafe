import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Container, Card, Badge, Button } from '@/components/ui';
import { CTASection } from '@/components/sections/CTASection';
import { LessonVideos } from '@/components/sections/LessonVideos';
import { generateLessonMetadata } from '@/utils/metadata';
import { LessonStructuredData } from '@/components/seo/StructuredData';

// レッスンデータ（実際の実装では API から取得）
const lessons = [
  {
    id: 'trial-lesson',
    title: '無料体験レッスン',
    titleEnglish: 'Free Trial Lesson',
    description: '初回限定の無料体験レッスンです。あなたの英語レベルをチェックし、最適な学習プランをご提案します。',
    detailedDescription: `
      英会話カフェが初めての方におすすめの無料体験レッスンです。
      
      このレッスンでは、まず簡単な英語でのカウンセリングを行い、あなたの現在の英語レベルを正確に把握します。その後、実際のレッスンを体験していただき、講師との相性やレッスンの雰囲気を確認できます。
      
      体験レッスン終了後には、あなたの英語レベルに合わせた最適な学習プランをご提案し、目標達成までのロードマップを一緒に作成します。
    `,
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
    targetAudience: ['英会話初心者', 'レベルチェック希望者', 'カフェ見学希望者'],
    curriculum: [
      {
        step: 1,
        title: 'カウンセリング',
        description: '英語学習の目標や現在のレベルについてお聞きします',
        duration: 10
      },
      {
        step: 2,
        title: 'レベルチェック',
        description: '簡単な会話とテストで英語レベルを診断します',
        duration: 15
      },
      {
        step: 3,
        title: '体験レッスン',
        description: '実際のレッスンを体験していただきます',
        duration: 20
      },
      {
        step: 4,
        title: 'フィードバック',
        description: '学習プランの提案とご質問にお答えします',
        duration: 5
      }
    ],
    requirements: [
      '特別な準備は不要です',
      '筆記用具をお持ちください',
      '英語に対する学習意欲'
    ],
    whatToExpect: [
      'リラックスした雰囲気でのレッスン',
      '講師からの丁寧なフィードバック',
      '今後の学習方針の明確化',
      'カフェの施設見学'
    ],
    videoId: 'dQw4w9WgXcQ' // サンプル動画ID（実際の実装では実際の動画IDを使用）
  },
  {
    id: 'group-conversation',
    title: 'グループ英会話',
    titleEnglish: 'Group Conversation',
    description: '最大4名の少人数グループで行う英会話レッスン。他の生徒との交流を通じて、実践的なコミュニケーション力を身につけます。',
    detailedDescription: `
      少人数制のグループレッスンで、実践的な英会話力を身につけるコースです。
      
      最大4名という少人数制により、一人ひとりが十分に発言する機会を確保しながら、他の生徒との交流を通じて多様な表現や視点を学ぶことができます。
      
      毎回異なるトピックを扱い、日常会話からビジネスシーンまで幅広い場面での英語表現を習得します。グループディスカッションやロールプレイを通じて、自然で流暢な英語を話せるようになります。
    `,
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
    targetAudience: ['英会話初級者', '交流を求める方', 'コスパ重視の方'],
    curriculum: [
      {
        step: 1,
        title: 'ウォームアップ',
        description: '簡単な挨拶と前回の復習',
        duration: 10
      },
      {
        step: 2,
        title: 'トピック導入',
        description: '今日のテーマについて語彙と表現を学習',
        duration: 15
      },
      {
        step: 3,
        title: 'グループディスカッション',
        description: 'テーマについてグループで議論',
        duration: 25
      },
      {
        step: 4,
        title: 'まとめ・フィードバック',
        description: '学んだ表現の確認と次回予告',
        duration: 10
      }
    ],
    requirements: [
      '基本的な英語の挨拶ができること',
      '積極的に参加する意欲',
      '他の生徒との協調性'
    ],
    whatToExpect: [
      '楽しい雰囲気でのレッスン',
      '実用的な英語表現の習得',
      '他の生徒との友好関係',
      '自信を持って話せるようになる'
    ],
    videoId: 'dQw4w9WgXcQ' // サンプル動画ID（実際の実装では実際の動画IDを使用）
  },
  {
    id: 'private-lesson',
    title: 'プライベートレッスン',
    titleEnglish: 'Private Lesson',
    description: '講師と1対1で行う完全個別指導レッスン。あなたの目標や弱点に合わせてカスタマイズされたレッスンを提供します。',
    detailedDescription: `
      あなただけのためにカスタマイズされた完全個別指導レッスンです。
      
      講師があなたの学習目標、現在のレベル、弱点を詳しく分析し、最も効果的な学習プランを作成します。レッスン内容は100%あなたのニーズに合わせて調整され、学習ペースもあなたに最適化されます。
      
      TOEIC対策、ビジネス英語、発音矯正、面接対策など、特定の目標がある方に特におすすめです。短期間で確実な成果を出したい方に最適なコースです。
    `,
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
    targetAudience: ['集中学習希望者', '特定目標がある方', '上達を急ぐ方'],
    curriculum: [
      {
        step: 1,
        title: '目標設定・レベルチェック',
        description: 'あなたの目標と現在のレベルを詳しく分析',
        duration: 10
      },
      {
        step: 2,
        title: 'カスタマイズレッスン',
        description: 'あなたのニーズに完全に合わせた内容',
        duration: 35
      },
      {
        step: 3,
        title: 'フィードバック・宿題',
        description: '詳細なフィードバックと次回までの課題',
        duration: 5
      }
    ],
    requirements: [
      '明確な学習目標',
      '継続的な学習への意欲',
      '宿題への取り組み'
    ],
    whatToExpect: [
      '完全にパーソナライズされたレッスン',
      '迅速な上達',
      '詳細なフィードバック',
      '柔軟なスケジュール調整'
    ],
    videoId: 'dQw4w9WgXcQ' // サンプル動画ID（実際の実装では実際の動画IDを使用）
  }
  // 他のレッスンも同様に追加...
];

interface LessonDetailPageProps {
  params: {
    id: string;
  };
}

export default function LessonDetailPage({ params }: LessonDetailPageProps) {
  const lesson = lessons.find(l => l.id === params.id);

  if (!lesson) {
    notFound();
  }

  const formatPrice = () => {
    if (lesson.price.amount === 0) {
      return '無料';
    }
    
    const periodText = {
      'per_lesson': '/回',
      'monthly': '/月',
      'per_hour': '/時間'
    } as const;

    return `¥${lesson.price.amount.toLocaleString()}${periodText[lesson.price.period as keyof typeof periodText]}`;
  };

  const getTypeLabel = (type: string) => {
    const typeLabels = {
      'trial': '体験レッスン',
      'group': 'グループレッスン',
      'private': 'プライベートレッスン',
      'online': 'オンラインレッスン'
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
    <>
      <LessonStructuredData lesson={lesson} />
      <main>
      {/* ヒーローセクション */}
      <section className="py-20 bg-gradient-to-r from-primary-600 to-primary-700 text-white">
        <Container>
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* レッスン情報 */}
            <div>
              <div className="flex items-center space-x-4 mb-6">
                <Link 
                  href="/lessons"
                  className="text-primary-100 hover:text-white transition-colors"
                >
                  ← レッスン一覧に戻る
                </Link>
                <div className="flex gap-2">
                  {lesson.recommended && (
                    <Badge variant="info" className="bg-white/20 text-white">
                      おすすめ
                    </Badge>
                  )}
                  {lesson.popular && (
                    <Badge variant="warning" className="bg-yellow-400/20 text-yellow-100">
                      人気
                    </Badge>
                  )}
                </div>
              </div>
              
              <Badge variant={getTypeBadgeVariant(lesson.type)} className="mb-4">
                {getTypeLabel(lesson.type)}
              </Badge>
              
              <h1 className="text-4xl md:text-5xl font-bold mb-2">
                {lesson.title}
              </h1>
              <p className="text-xl text-primary-100 mb-6">
                {lesson.titleEnglish}
              </p>
              
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <span className="text-primary-100 block">料金</span>
                  <span className="font-bold text-2xl">{formatPrice()}</span>
                  {lesson.price.originalPrice && (
                    <span className="text-primary-200 line-through ml-2">
                      ¥{lesson.price.originalPrice.toLocaleString()}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-primary-100 block">時間</span>
                  <span className="font-bold text-2xl">{lesson.duration}分</span>
                </div>
                {lesson.maxStudents && (
                  <div>
                    <span className="text-primary-100 block">定員</span>
                    <span className="font-bold text-2xl">最大{lesson.maxStudents}名</span>
                  </div>
                )}
                <div>
                  <span className="text-primary-100 block">対象レベル</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {lesson.level.map((level, idx) => (
                      <Badge key={idx} variant="info" size="sm" className="bg-white/20 text-white">
                        {level}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <p className="text-lg text-primary-100 mb-8">
                {lesson.description}
              </p>

              <div className="flex gap-4">
                <Button size="lg" variant="secondary" className="bg-white text-primary-600 hover:bg-gray-100" asChild>
                  <Link href="/contact">
                    {lesson.type === 'trial' ? '無料体験予約' : 'レッスン予約'}
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10" asChild>
                  <Link href="/contact">
                    お問い合わせ
                  </Link>
                </Button>
              </div>
            </div>

            {/* レッスン画像 */}
            <div className="relative">
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl">
                <Image
                  src={lesson.image}
                  alt={`${lesson.title}のイメージ`}
                  fill
                  className="object-cover"
                  priority
                />
              </div>
              
              {/* 装飾要素 */}
              <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/20 rounded-full" />
              <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-white/10 rounded-full" />
            </div>
          </div>
        </Container>
      </section>

      {/* 詳細情報 */}
      <section className="py-20 bg-white">
        <Container>
          <div className="grid lg:grid-cols-3 gap-12">
            {/* メインコンテンツ */}
            <div className="lg:col-span-2 space-y-12">
              {/* レッスン詳細 */}
              <Card className="p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  レッスン詳細
                </h2>
                <div className="prose prose-lg max-w-none text-gray-700">
                  {lesson.detailedDescription.split('\n').map((paragraph, idx) => (
                    paragraph.trim() && (
                      <p key={idx} className="mb-4">
                        {paragraph.trim()}
                      </p>
                    )
                  ))}
                </div>
              </Card>

              {/* レッスン紹介動画 */}
              <LessonVideos lessonType={lesson.type} lessonTitle={lesson.title} />

              {/* カリキュラム */}
              {lesson.curriculum && (
                <Card className="p-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">
                    レッスンの流れ
                  </h2>
                  <div className="space-y-6">
                    {lesson.curriculum.map((item, idx) => (
                      <div key={idx} className="flex">
                        <div className="flex-shrink-0 w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mr-4">
                          <span className="font-bold text-primary-600">{item.step}</span>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            {item.title}
                            <span className="text-sm text-gray-500 ml-2">({item.duration}分)</span>
                          </h3>
                          <p className="text-gray-700">{item.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* 受講要件・期待できること */}
              <div className="grid md:grid-cols-2 gap-8">
                {lesson.requirements && (
                  <Card className="p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">
                      受講要件
                    </h3>
                    <ul className="space-y-2">
                      {lesson.requirements.map((req, idx) => (
                        <li key={idx} className="flex items-start">
                          <svg className="w-5 h-5 text-primary-600 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="text-gray-700">{req}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}

                {lesson.whatToExpect && (
                  <Card className="p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">
                      期待できること
                    </h3>
                    <ul className="space-y-2">
                      {lesson.whatToExpect.map((expectation, idx) => (
                        <li key={idx} className="flex items-start">
                          <svg className="w-5 h-5 text-yellow-500 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          <span className="text-gray-700">{expectation}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
              </div>
            </div>

            {/* サイドバー */}
            <div className="space-y-8">
              {/* 基本情報 */}
              <Card className="p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  基本情報
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">レッスンの特徴</h4>
                    <div className="flex flex-wrap gap-2">
                      {lesson.features.map((feature, idx) => (
                        <Badge key={idx} variant="primary" size="sm">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">メリット</h4>
                    <ul className="space-y-1">
                      {lesson.benefits.map((benefit, idx) => (
                        <li key={idx} className="text-sm text-gray-600">
                          • {benefit}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">こんな方におすすめ</h4>
                    <ul className="space-y-1">
                      {lesson.targetAudience.map((audience, idx) => (
                        <li key={idx} className="text-sm text-gray-600">
                          • {audience}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Card>

              {/* スケジュール */}
              <Card className="p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  開講スケジュール
                </h3>
                
                <div className="space-y-2">
                  {lesson.schedule.map((time, idx) => (
                    <div key={idx} className="flex items-center py-2">
                      <svg className="w-4 h-4 text-primary-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm text-gray-700">{time}</span>
                    </div>
                  ))}
                </div>
                
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-800">
                    ※ スケジュールは変更される場合があります。<br />
                    最新の空き状況はお問い合わせください。
                  </p>
                </div>
              </Card>

              {/* 予約ボタン */}
              <div className="space-y-3">
                <Button className="w-full" size="lg" asChild>
                  <Link href="/contact">
                    {lesson.type === 'trial' ? '無料体験予約' : 'レッスン予約'}
                  </Link>
                </Button>
                <Button variant="outline" className="w-full" size="lg" asChild>
                  <Link href="/contact">
                    お問い合わせ
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* CTA */}
      <CTASection 
        variant="primary"
        title={`${lesson.title}で英語力を向上させませんか？`}
        description="経験豊富な講師との質の高いレッスンで、あなたの英語学習目標を達成しましょう。まずはお気軽にお問い合わせください。"
        primaryButtonText={lesson.type === 'trial' ? '無料体験予約' : 'レッスン予約'}
        secondaryButtonText="他のレッスンを見る"
        secondaryButtonHref="/lessons"
      />
    </main>
    </>
  );
}

// 静的パラメータ生成（本番では動的に生成）
export function generateStaticParams() {
  return lessons.map((lesson) => ({
    id: lesson.id,
  }));
}

// メタデータ生成
export function generateMetadata({ params }: LessonDetailPageProps) {
  const lesson = lessons.find(l => l.id === params.id);
  
  if (!lesson) {
    return {
      title: 'レッスンが見つかりません',
    };
  }

  return generateLessonMetadata(
    {
      title: lesson.title,
      description: lesson.description,
      type: lesson.type,
      price: lesson.price,
      duration: lesson.duration,
      level: lesson.level
    },
    lesson.id
  );
}