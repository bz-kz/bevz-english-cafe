import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Container, Card, Badge, Button } from '@/components/ui';
import { CTASection } from '@/components/sections/CTASection';
import { InstructorVideos } from '@/components/sections/InstructorVideos';
import { generateInstructorMetadata } from '@/utils/metadata';
import { InstructorStructuredData } from '@/components/seo/StructuredData';

// 講師データ（実際の実装では API から取得）
const teachers = [
  {
    id: 'sarah',
    name: 'Sarah Johnson',
    nameJapanese: 'サラ・ジョンソン',
    nationality: 'アメリカ',
    photo: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    specialization: ['日常英会話', 'ビジネス英語', 'TOEIC対策'],
    experience: '8年',
    introduction: 'こんにちは！アメリカ出身のサラです。日本に住んで5年になります。皆さんが楽しく英語を学べるよう、一人ひとりに合わせたレッスンを心がけています。大学では言語学を専攻し、卒業後は企業での英語研修も担当していました。',
    languages: ['英語（ネイティブ）', '日本語（上級）', 'スペイン語（中級）'],
    certifications: ['TESOL', 'TOEIC 990点', 'Cambridge CELTA'],
    hobbies: ['料理', '映画鑑賞', '旅行', 'ヨガ'],
    teachingStyle: 'フレンドリーで楽しい雰囲気を大切にし、間違いを恐れずに話せる環境作りを心がけています。実際の場面を想定したロールプレイングを多く取り入れ、実用的な英語力の向上を目指します。',
    featured: true,
    rating: 4.9,
    reviewCount: 127,
    education: 'カリフォルニア大学 言語学部卒業',
    workExperience: [
      '大手商社での英語研修講師（3年）',
      '国際会議通訳（2年）',
      '英会話スクール講師（8年）'
    ],
    achievements: [
      'TOEIC満点取得',
      '企業研修実績100社以上',
      '生徒のTOEICスコア平均200点アップ'
    ],
    schedule: {
      monday: '10:00-18:00',
      tuesday: '10:00-18:00',
      wednesday: '休み',
      thursday: '10:00-18:00',
      friday: '10:00-18:00',
      saturday: '9:00-15:00',
      sunday: '休み'
    },
    videoId: 'dQw4w9WgXcQ' // サンプル動画ID（実際の実装では実際の動画IDを使用）
  },
  {
    id: 'james',
    name: 'James Wilson',
    nameJapanese: 'ジェームス・ウィルソン',
    nationality: 'イギリス',
    photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    specialization: ['発音矯正', 'イギリス英語', 'プレゼンテーション'],
    experience: '6年',
    introduction: 'イギリス出身のジェームスです。正しい発音と自然な表現を身につけたい方、ぜひ一緒に学びましょう！特に発音矯正とプレゼンテーション指導を得意としています。',
    languages: ['英語（ネイティブ）', '日本語（中級）', 'フランス語（初級）'],
    certifications: ['CELTA', 'Cambridge English Teaching', 'Pronunciation Specialist'],
    hobbies: ['音楽', 'サッカー', '読書', 'ギター'],
    teachingStyle: '発音とイントネーションに重点を置き、実践的なコミュニケーション能力の向上を目指します。音楽的なアプローチで楽しく発音を学べるよう工夫しています。',
    featured: false,
    rating: 4.8,
    reviewCount: 89,
    education: 'オックスフォード大学 英文学部卒業',
    workExperience: [
      'BBC放送局アナウンサー（2年）',
      '大学講師（3年）',
      '英会話スクール講師（6年）'
    ],
    achievements: [
      'Cambridge English Teaching Award受賞',
      '発音矯正専門資格取得',
      '企業プレゼン研修実績50社以上'
    ],
    schedule: {
      monday: '13:00-21:00',
      tuesday: '13:00-21:00',
      wednesday: '13:00-21:00',
      thursday: '休み',
      friday: '13:00-21:00',
      saturday: '10:00-16:00',
      sunday: '休み'
    },
    videoId: 'dQw4w9WgXcQ' // サンプル動画ID（実際の実装では実際の動画IDを使用）
  }
  // 他の講師データも同様に追加...
];

interface TeacherDetailPageProps {
  params: {
    id: string;
  };
}

export default function TeacherDetailPage({ params }: TeacherDetailPageProps) {
  const teacher = teachers.find(t => t.id === params.id);

  if (!teacher) {
    notFound();
  }

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <svg
        key={i}
        className={`w-5 h-5 ${i < Math.floor(rating) ? 'text-yellow-400' : 'text-gray-300'}`}
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ));
  };

  const formatSchedule = (schedule: any) => {
    const days = [
      { key: 'monday', label: '月' },
      { key: 'tuesday', label: '火' },
      { key: 'wednesday', label: '水' },
      { key: 'thursday', label: '木' },
      { key: 'friday', label: '金' },
      { key: 'saturday', label: '土' },
      { key: 'sunday', label: '日' }
    ];

    return days.map(day => ({
      day: day.label,
      time: schedule[day.key] || '休み'
    }));
  };

  return (
    <>
      <InstructorStructuredData instructor={teacher} />
      <main>
      {/* ヒーローセクション */}
      <section className="py-20 bg-gradient-to-r from-primary-600 to-primary-700 text-white">
        <Container>
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* 講師情報 */}
            <div>
              <div className="flex items-center space-x-4 mb-6">
                <Link 
                  href="/instructors"
                  className="text-primary-100 hover:text-white transition-colors"
                >
                  ← 講師一覧に戻る
                </Link>
                {teacher.featured && (
                  <Badge variant="info" className="bg-white/20 text-white">
                    人気講師
                  </Badge>
                )}
              </div>
              
              <h1 className="text-4xl md:text-5xl font-bold mb-2">
                {teacher.name}
              </h1>
              <p className="text-xl text-primary-100 mb-4">
                {teacher.nameJapanese}
              </p>
              
              <div className="flex items-center space-x-6 mb-6">
                <div className="flex items-center space-x-2">
                  <span className="text-primary-100">出身:</span>
                  <span className="font-medium">{teacher.nationality}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-primary-100">経験:</span>
                  <span className="font-medium">{teacher.experience}</span>
                </div>
              </div>

              <div className="flex items-center space-x-4 mb-6">
                <div className="flex items-center space-x-2">
                  <div className="flex">
                    {renderStars(teacher.rating)}
                  </div>
                  <span className="font-bold text-xl">{teacher.rating}</span>
                </div>
                <span className="text-primary-100">
                  {teacher.reviewCount}件のレビュー
                </span>
              </div>

              <div className="flex flex-wrap gap-2 mb-8">
                {teacher.specialization.map((spec, idx) => (
                  <Badge key={idx} variant="info" className="bg-white/20 text-white">
                    {spec}
                  </Badge>
                ))}
              </div>

              <div className="flex gap-4">
                <Button size="lg" className="bg-white text-primary-600 hover:bg-gray-100" asChild>
                  <Link href="/contact">
                    この講師でレッスン予約
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10" asChild>
                  <Link href="/contact">
                    無料体験レッスン
                  </Link>
                </Button>
              </div>
            </div>

            {/* 講師写真 */}
            <div className="relative">
              <div className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl">
                <Image
                  src={teacher.photo}
                  alt={`${teacher.name}講師の写真`}
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
              {/* 自己紹介 */}
              <Card className="p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  自己紹介
                </h2>
                <p className="text-gray-700 leading-relaxed text-lg">
                  {teacher.introduction}
                </p>
              </Card>

              {/* 指導スタイル */}
              <Card className="p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  指導スタイル
                </h2>
                <p className="text-gray-700 leading-relaxed text-lg">
                  {teacher.teachingStyle}
                </p>
              </Card>

              {/* 講師紹介動画 */}
              <InstructorVideos teacherId={teacher.id} teacherName={teacher.name} />

              {/* 経歴・実績 */}
              <Card className="p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  経歴・実績
                </h2>
                
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">学歴</h3>
                    <p className="text-gray-700">{teacher.education}</p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">職歴</h3>
                    <ul className="space-y-2">
                      {teacher.workExperience.map((exp, idx) => (
                        <li key={idx} className="flex items-start">
                          <svg className="w-5 h-5 text-primary-600 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="text-gray-700">{exp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">主な実績</h3>
                    <ul className="space-y-2">
                      {teacher.achievements.map((achievement, idx) => (
                        <li key={idx} className="flex items-start">
                          <svg className="w-5 h-5 text-yellow-500 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          <span className="text-gray-700">{achievement}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Card>
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
                    <h4 className="font-medium text-gray-900 mb-2">専門分野</h4>
                    <div className="flex flex-wrap gap-2">
                      {teacher.specialization.map((spec, idx) => (
                        <Badge key={idx} variant="primary">
                          {spec}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">話せる言語</h4>
                    <ul className="space-y-1">
                      {teacher.languages.map((lang, idx) => (
                        <li key={idx} className="text-sm text-gray-600">
                          • {lang}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">保有資格</h4>
                    <div className="flex flex-wrap gap-2">
                      {teacher.certifications.map((cert, idx) => (
                        <Badge key={idx} variant="success">
                          {cert}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">趣味・興味</h4>
                    <p className="text-sm text-gray-600">
                      {teacher.hobbies.join('、')}
                    </p>
                  </div>
                </div>
              </Card>

              {/* スケジュール */}
              <Card className="p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  レッスンスケジュール
                </h3>
                
                <div className="space-y-2">
                  {formatSchedule(teacher.schedule).map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center py-2">
                      <span className="font-medium text-gray-900">{item.day}</span>
                      <span className={`text-sm ${item.time === '休み' ? 'text-red-500' : 'text-gray-600'}`}>
                        {item.time}
                      </span>
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
                    この講師でレッスン予約
                  </Link>
                </Button>
                <Button variant="outline" className="w-full" size="lg" asChild>
                  <Link href="/contact">
                    無料体験レッスン
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
        title={`${teacher.name}先生のレッスンを受けてみませんか？`}
        description="経験豊富な講師との楽しいレッスンで、あなたの英語力を向上させましょう。まずは無料体験レッスンからお気軽にどうぞ。"
        primaryButtonText="無料体験レッスンを予約"
        secondaryButtonText="レッスン詳細を見る"
        secondaryButtonHref="/lessons"
      />
    </main>
    </>
  );
}

// 静的パラメータ生成（本番では動的に生成）
export function generateStaticParams() {
  return teachers.map((teacher) => ({
    id: teacher.id,
  }));
}

// メタデータ生成
export function generateMetadata({ params }: TeacherDetailPageProps) {
  const teacher = teachers.find(t => t.id === params.id);
  
  if (!teacher) {
    return {
      title: '講師が見つかりません',
    };
  }

  return generateInstructorMetadata(
    {
      name: teacher.name,
      nameJapanese: teacher.nameJapanese,
      nationality: teacher.nationality,
      specialization: teacher.specialization,
      experience: teacher.experience,
      introduction: teacher.introduction
    },
    teacher.id
  );
}