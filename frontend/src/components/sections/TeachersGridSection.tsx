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
import { teachers as allTeachers } from '@/data/teachers';

const nationalities = [
  '全て',
  'アメリカ',
  'イギリス',
  'カナダ',
  'オーストラリア',
];
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
  '上級者向け',
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
      const matchesSearch =
        teacher.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        teacher.nameJapanese
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        teacher.specialization.some(spec =>
          spec.toLowerCase().includes(searchQuery.toLowerCase())
        );

      const matchesNationality =
        selectedNationality === '全て' ||
        teacher.nationality === selectedNationality;
      const matchesSpecialization =
        selectedSpecialization === '全て' ||
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
          'h-4 w-4',
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
    <section ref={sectionRef} className={cn('bg-gray-50 py-20', className)}>
      <Container>
        {/* フィルター・検索エリア */}
        <div
          className={cn(
            'mb-12 transform rounded-2xl bg-white p-6 shadow-sm transition-all duration-1000',
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
          )}
        >
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <Input
                placeholder="講師名や専門分野で検索..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>

            <Select
              options={nationalities.map(nat => ({ value: nat, label: nat }))}
              value={selectedNationality}
              onChange={e => setSelectedNationality(e.target.value)}
              placeholder="出身国"
            />

            <Select
              options={specializations.map(spec => ({
                value: spec,
                label: spec,
              }))}
              value={selectedSpecialization}
              onChange={e => setSelectedSpecialization(e.target.value)}
              placeholder="専門分野"
            />

            <Select
              options={[
                { value: 'featured', label: 'おすすめ順' },
                { value: 'rating', label: '評価順' },
                { value: 'experience', label: '経験順' },
                { value: 'name', label: '名前順' },
              ]}
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              placeholder="並び順"
            />
          </div>

          <div className="mt-4 text-sm text-gray-600">
            {filteredTeachers.length}名の講師が見つかりました
          </div>
        </div>

        {/* 講師グリッド */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {filteredTeachers.map((teacher, index) => (
            <Card
              key={teacher.id}
              className={cn(
                'transform overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-xl',
                teacher.featured && 'ring-2 ring-primary-500',
                isVisible
                  ? 'translate-y-0 opacity-100'
                  : 'translate-y-8 opacity-0'
              )}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              {teacher.featured && (
                <Badge variant="primary" className="absolute left-4 top-4 z-10">
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
                <div className="absolute right-4 top-4 rounded-lg bg-white/90 px-2 py-1 backdrop-blur-sm">
                  <div className="flex items-center space-x-1">
                    <div className="flex">{renderStars(teacher.rating)}</div>
                    <span className="text-xs font-medium text-gray-900">
                      {teacher.rating}
                    </span>
                  </div>
                </div>

                {/* 国籍 */}
                <div className="absolute bottom-4 right-4 rounded-full bg-white/90 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                  {teacher.nationality}
                </div>
              </div>

              {/* 講師情報 */}
              <div className="p-6">
                <div className="mb-4">
                  <h3 className="mb-1 text-lg font-bold text-gray-900">
                    {teacher.name}
                  </h3>
                  <p className="mb-2 text-sm text-gray-500">
                    {teacher.nameJapanese}
                  </p>

                  <div className="mb-3 flex items-center justify-between text-xs text-gray-600">
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

                <p className="mb-4 line-clamp-3 text-sm text-gray-600">
                  {teacher.introduction}
                </p>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    asChild
                  >
                    <Link href={`/instructors/${teacher.id}`}>詳細</Link>
                  </Button>
                  <Button size="sm" className="flex-1" asChild>
                    <Link href="/contact">予約</Link>
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* 結果が見つからない場合 */}
        {filteredTeachers.length === 0 && (
          <div className="py-12 text-center">
            <div className="mb-4 text-6xl">🔍</div>
            <h3 className="mb-2 text-xl font-semibold text-gray-900">
              講師が見つかりませんでした
            </h3>
            <p className="mb-6 text-gray-600">
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
