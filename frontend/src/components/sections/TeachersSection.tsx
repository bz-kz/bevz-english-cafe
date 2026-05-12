/**
 * Teachers Section Component
 * 講師紹介セクション
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Container, Card, Button, Badge, Avatar } from '@/components/ui';
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
}

const teachers: Teacher[] = [
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
    featured: true
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
    featured: false
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
    featured: false
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
    featured: true
  }
];

interface TeachersSectionProps {
  className?: string;
  showAll?: boolean;
  maxTeachers?: number;
}

export function TeachersSection({ 
  className, 
  showAll = false, 
  maxTeachers = 4 
}: TeachersSectionProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const sectionRef = useRef<HTMLElement>(null);

  const displayTeachers = showAll ? teachers : teachers.slice(0, maxTeachers);

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
            講師紹介
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            経験豊富なネイティブ講師陣があなたの英語学習をサポートします
          </p>
        </div>

        {/* 講師カードグリッド */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {displayTeachers.map((teacher, index) => (
            <Card
              key={teacher.id}
              className={cn(
                'relative overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:scale-105 cursor-pointer',
                teacher.featured && 'ring-2 ring-primary-500',
                isVisible 
                  ? 'translate-y-0 opacity-100' 
                  : 'translate-y-8 opacity-0'
              )}
              style={{ transitionDelay: `${index * 150}ms` }}
              onClick={() => setSelectedTeacher(teacher)}
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
              <div className="relative aspect-[3/4] overflow-hidden">
                <Image
                  src={teacher.photo}
                  alt={`${teacher.name}講師の写真`}
                  fill
                  className="object-cover transition-transform duration-300 hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                
                {/* 国籍フラグ */}
                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-medium">
                  {teacher.nationality}
                </div>
              </div>

              {/* 講師情報 */}
              <div className="p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-1">
                  {teacher.name}
                </h3>
                <p className="text-sm text-gray-500 mb-3">
                  {teacher.nameJapanese}
                </p>
                
                <div className="mb-4">
                  <p className="text-xs text-gray-600 mb-2">
                    指導経験: {teacher.experience}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {teacher.specialization.slice(0, 2).map((spec, idx) => (
                      <Badge key={idx} variant="default" size="sm">
                        {spec}
                      </Badge>
                    ))}
                    {teacher.specialization.length > 2 && (
                      <Badge variant="default" size="sm">
                        +{teacher.specialization.length - 2}
                      </Badge>
                    )}
                  </div>
                </div>

                <p className="text-sm text-gray-600 line-clamp-3 mb-4">
                  {teacher.introduction}
                </p>

                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedTeacher(teacher);
                  }}
                >
                  詳細を見る
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {/* 全講師を見るボタン */}
        {!showAll && teachers.length > maxTeachers && (
          <div className="text-center">
            <Button size="lg" variant="outline" asChild>
              <Link href="/instructors">
                全ての講師を見る
              </Link>
            </Button>
          </div>
        )}

        {/* 講師詳細モーダル */}
        {selectedTeacher && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="relative">
                {/* ヘッダー画像 */}
                <div className="relative h-48 overflow-hidden rounded-t-2xl">
                  <Image
                    src={selectedTeacher.photo}
                    alt={`${selectedTeacher.name}講師の写真`}
                    fill
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  
                  {/* 閉じるボタン */}
                  <button
                    onClick={() => setSelectedTeacher(null)}
                    className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm rounded-full p-2 text-white hover:bg-white/30 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>

                  {/* 講師基本情報 */}
                  <div className="absolute bottom-4 left-6 text-white">
                    <h3 className="text-2xl font-bold mb-1">
                      {selectedTeacher.name}
                    </h3>
                    <p className="text-lg opacity-90">
                      {selectedTeacher.nameJapanese}
                    </p>
                  </div>
                </div>

                {/* 詳細情報 */}
                <div className="p-6 space-y-6">
                  {/* 基本情報 */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">出身国</h4>
                      <p className="text-gray-600">{selectedTeacher.nationality}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">指導経験</h4>
                      <p className="text-gray-600">{selectedTeacher.experience}</p>
                    </div>
                  </div>

                  {/* 自己紹介 */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">自己紹介</h4>
                    <p className="text-gray-600 leading-relaxed">
                      {selectedTeacher.introduction}
                    </p>
                  </div>

                  {/* 指導スタイル */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">指導スタイル</h4>
                    <p className="text-gray-600 leading-relaxed">
                      {selectedTeacher.teachingStyle}
                    </p>
                  </div>

                  {/* 専門分野 */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">専門分野</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedTeacher.specialization.map((spec, idx) => (
                        <Badge key={idx} variant="primary">
                          {spec}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* 言語 */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">話せる言語</h4>
                    <ul className="text-gray-600 space-y-1">
                      {selectedTeacher.languages.map((lang, idx) => (
                        <li key={idx} className="flex items-center">
                          <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          {lang}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* 資格 */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">保有資格</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedTeacher.certifications.map((cert, idx) => (
                        <Badge key={idx} variant="success">
                          {cert}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* 趣味 */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">趣味・興味</h4>
                    <p className="text-gray-600">
                      {selectedTeacher.hobbies.join('、')}
                    </p>
                  </div>

                  {/* アクションボタン */}
                  <div className="flex gap-4 pt-4">
                    <Button className="flex-1" asChild>
                      <Link href="/contact">
                        この講師でレッスン予約
                      </Link>
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setSelectedTeacher(null)}
                    >
                      閉じる
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Container>
    </section>
  );
}