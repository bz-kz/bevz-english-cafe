/**
 * Teachers Grid Section Component
 * 講師一覧ページ用のグリッド表示コンポーネント
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Container, Card, Button, Badge, Input, Select } from '@/components/ui';
import { cn } from '@/utils/cn';

interface Teacher {
  id: string;
  name: string;
  nameJapanese?: string;
  nationality: string;
  photo: string;
  specialization: string[];
  experience: string;
  introduction: string;
  languages: string[];
  certifications: string[];
  hobbies: string[];
  teachingStyle: string;
  featured?: boolean;
  rating: number;
  reviewCount: number;
}

// 拡張された講師データ
const allTeachers: Teacher[] = [
  {
    id: 'sarah',
    name: 'Sarah Johnson',
    nameJapanese: 'サラ・ジョンソン',
    nationality: 'アメリカ',
    photo: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
    specialization: ['日常英会話', 'ビジネス英語', 'TOEIC対策'],
    experience: '8年',
    introduction: 'こんにちは！アメリカ出身のサラです。日本に住んで5年になります。皆さんが楽しく英語を学べるよう、一人ひとりに合わせたレッスンを心がけています。',
    languages: ['英語（ネイティブ）', '日本語（上級）', 'スペイン語（中級）'],
    certifications: ['TESOL', 'TOEIC 990点'],
    hobbies: ['料理', '映画鑑賞', '旅行'],
    teachingStyle: 'フレンドリーで楽しい雰囲気を大切にし、間違いを恐れずに話せる環境作りを心がけています。',
    featured: true,
    rating: 4.9,
    reviewCount: 127
  },
  {
    id: 'james',
    name: 'James Wilson',
    nameJapanese: 'ジェームス・ウィルソン',
    nationality: 'イギリス',
    photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
    specialization: ['発音矯正', 'イギリス英語', 'プレゼンテーション'],
    experience: '6年',
    introduction: 'イギリス出身のジェームスです。正しい発音と自然な表現を身につけたい方、ぜひ一緒に学びましょう！',
    languages: ['英語（ネイティブ）', '日本語（中級）', 'フランス語（初級）'],
    certifications: ['CELTA', 'Cambridge English Teaching'],
    hobbies: ['音楽', 'サッカー', '読書'],
    teachingStyle: '発音とイントネーションに重点を置き、実践的なコミュニケーション能力の向上を目指します。',
    featured: false,
    rating: 4.8,
    reviewCount: 89
  },
  {
    id: 'emma',
    name: 'Emma Thompson',
    nameJapanese: 'エマ・トンプソン',
    nationality: 'カナダ',
    photo: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
    specialization: ['キッズ英語', '初心者向け', '文法基礎'],
    experience: '4年',
    introduction: 'カナダ出身のエマです。英語が初めての方でも安心して学べるよう、基礎からしっかりサポートします。',
    languages: ['英語（ネイティブ）', '日本語（中級）'],
    certifications: ['TEFL', 'Child Development Certificate'],
    hobbies: ['アート', 'ヨガ', 'ガーデニング'],
    teachingStyle: '優しく丁寧な指導で、基礎からしっかりと英語力を身につけられるようサポートします。',
    featured: false,
    rating: 4.7,
    reviewCount: 64
  },
  {
    id: 'michael',
    name: 'Michael Brown',
    nameJapanese: 'マイケル・ブラウン',
    nationality: 'オーストラリア',
    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
    specialization: ['ビジネス英語', 'IELTS対策', '上級者向け'],
    experience: '10年',
    introduction: 'オーストラリア出身のマイケルです。ビジネスシーンで使える実践的な英語を一緒に学びましょう！',
    languages: ['英語（ネイティブ）', '日本語（上級）', '中国語（初級）'],
    certifications: ['TESOL', 'IELTS Examiner', 'Business English Certificate'],
    hobbies: ['サーフィン', 'カメラ', 'コーヒー'],
    teachingStyle: 'ビジネス経験を活かした実践的なレッスンで、即戦力となる英語力を身につけます。',
    featured: true,
    rating: 4.9,
    reviewCount: 156
  },
  {
    id: 'lisa',
    name: 'Lisa Davis',
    nameJapanese: 'リサ・デイビス',
    nationality: 'アメリカ',
    photo: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
    specialization: ['TOEFL対策', '留学準備', 'アカデミック英語'],
    experience: '7年',
    introduction: 'アメリカの大学で言語学を学んだリサです。留学や進学を目指す方のサポートが得意です。',
    languages: ['英語（ネイティブ）', '日本語（中級）', 'ドイツ語（初級）'],
    certifications: ['TESOL', 'TOEFL iBT Instructor'],
    hobbies: ['言語学習', 'ハイキング', '写真'],
    teachingStyle: 'アカデミックな英語力向上に重点を置き、論理的思考力も同時に育成します。',
    featured: false,
    rating: 4.8,
    reviewCount: 73
  },
  {
    id: 'david',
    name: 'David Miller',
    nameJapanese: 'デイビッド・ミラー',
    nationality: 'イギリス',
    photo: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
    specialization: ['英文法', '英作文', 'Cambridge試験対策'],
    experience: '9年',
    introduction: 'イギリス出身のデイビッドです。文法や英作文を通じて、正確で美しい英語を身につけましょう。',
    languages: ['英語（ネイティブ）', '日本語（上級）', 'イタリア語（中級）'],
    certifications: ['CELTA', 'Cambridge ESOL Examiner'],
    hobbies: ['文学', 'クラシック音楽', 'チェス'],
    teachingStyle: '文法の基礎を重視し、正確で洗練された英語表現力の習得を目指します。',
    featured: false,
    rating: 4.6,
    reviewCount: 92
  }
];

const nationalities = ['全て', 'アメリカ', 'イギリス', 'カナダ', 'オーストラリア'];
const specializations = [
  '全て',
  '日常英会話',
  'ビジネス英語',
  'TOEIC対策',
  'TOEFL対策',
  'IELTS対策',
  '発音矯正',
  'キッズ英語',
  '初心者向け',
  '上級者向け'
];

interface TeachersGridSectionProps {
  className?: string;
}

export function TeachersGridSection({ className }: TeachersGridSectionProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [filteredTeachers, setFilteredTeachers] = useState(allTeachers);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNationality, setSelectedNationality] = useState('全て');
  const [selectedSpecialization, setSelectedSpecialization] = useState('全て');
  const [sortBy, setSortBy] = useState('featured');
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
    let filtered = allTeachers.filter(teacher => {
      const matchesSearch = teacher.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           teacher.nameJapanese?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           teacher.specialization.some(spec => spec.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesNationality = selectedNationality === '全て' || teacher.nationality === selectedNationality;
      const matchesSpecialization = selectedSpecialization === '全て' || 
                                   teacher.specialization.includes(selectedSpecialization);

      return matchesSearch && matchesNationality && matchesSpecialization;
    });

    // ソート
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'featured':
          if (a.featured && !b.featured) return -1;
          if (!a.featured && b.featured) return 1;
          return b.rating - a.rating;
        case 'rating':
          return b.rating - a.rating;
        case 'experience':
          return parseInt(b.experience) - parseInt(a.experience);
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    setFilteredTeachers(filtered);
  }, [searchQuery, selectedNationality, selectedSpecialization, sortBy]);

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <svg
        key={i}
        className={cn(
          'w-4 h-4',
          i < Math.floor(rating) ? 'text-yellow-400' : 'text-gray-300'
        )}
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ));
  };

  return (
    <section 
      ref={sectionRef}
      className={cn('py-20 bg-gray-50', className)}
    >
      <Container>
        {/* フィルター・検索エリア */}
        <div className={cn(
          'bg-white rounded-2xl p-6 shadow-sm mb-12 transform transition-all duration-1000',
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
        )}>
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2">
              <Input
                placeholder="講師名や専門分野で検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
            
            <Select
              options={nationalities.map(nat => ({ value: nat, label: nat }))}
              value={selectedNationality}
              onChange={(e) => setSelectedNationality(e.target.value)}
              placeholder="出身国"
            />
            
            <Select
              options={specializations.map(spec => ({ value: spec, label: spec }))}
              value={selectedSpecialization}
              onChange={(e) => setSelectedSpecialization(e.target.value)}
              placeholder="専門分野"
            />
            
            <Select
              options={[
                { value: 'featured', label: 'おすすめ順' },
                { value: 'rating', label: '評価順' },
                { value: 'experience', label: '経験順' },
                { value: 'name', label: '名前順' }
              ]}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              placeholder="並び順"
            />
          </div>
          
          <div className="mt-4 text-sm text-gray-600">
            {filteredTeachers.length}名の講師が見つかりました
          </div>
        </div>

        {/* 講師グリッド */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredTeachers.map((teacher, index) => (
            <Card
              key={teacher.id}
              className={cn(
                'overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:scale-105',
                teacher.featured && 'ring-2 ring-primary-500',
                isVisible 
                  ? 'translate-y-0 opacity-100' 
                  : 'translate-y-8 opacity-0'
              )}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              {teacher.featured && (
                <Badge 
                  variant="primary" 
                  className="absolute top-4 left-4 z-10"
                >
                  人気講師
                </Badge>
              )}

              {/* 講師写真 */}
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src={teacher.photo}
                  alt={`${teacher.name}講師の写真`}
                  fill
                  className="object-cover transition-transform duration-300 hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                
                {/* 評価 */}
                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg px-2 py-1">
                  <div className="flex items-center space-x-1">
                    <div className="flex">
                      {renderStars(teacher.rating)}
                    </div>
                    <span className="text-xs font-medium text-gray-900">
                      {teacher.rating}
                    </span>
                  </div>
                </div>

                {/* 国籍 */}
                <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-medium">
                  {teacher.nationality}
                </div>
              </div>

              {/* 講師情報 */}
              <div className="p-6">
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">
                    {teacher.name}
                  </h3>
                  <p className="text-sm text-gray-500 mb-2">
                    {teacher.nameJapanese}
                  </p>
                  
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-3">
                    <span>経験: {teacher.experience}</span>
                    <span>{teacher.reviewCount}件のレビュー</span>
                  </div>
                </div>
                
                <div className="mb-4">
                  <div className="flex flex-wrap gap-1">
                    {teacher.specialization.slice(0, 3).map((spec, idx) => (
                      <Badge key={idx} variant="default" size="sm">
                        {spec}
                      </Badge>
                    ))}
                    {teacher.specialization.length > 3 && (
                      <Badge variant="default" size="sm">
                        +{teacher.specialization.length - 3}
                      </Badge>
                    )}
                  </div>
                </div>

                <p className="text-sm text-gray-600 line-clamp-3 mb-4">
                  {teacher.introduction}
                </p>

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    asChild
                  >
                    <Link href={`/instructors/${teacher.id}`}>
                      詳細
                    </Link>
                  </Button>
                  <Button 
                    size="sm" 
                    className="flex-1"
                    asChild
                  >
                    <Link href="/contact">
                      予約
                    </Link>
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* 結果が見つからない場合 */}
        {filteredTeachers.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              講師が見つかりませんでした
            </h3>
            <p className="text-gray-600 mb-6">
              検索条件を変更してもう一度お試しください
            </p>
            <Button 
              variant="outline"
              onClick={() => {
                setSearchQuery('');
                setSelectedNationality('全て');
                setSelectedSpecialization('全て');
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