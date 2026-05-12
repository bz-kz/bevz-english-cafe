/**
 * Teachers data
 * 講師紹介セクションで使用する静的データ
 *
 * `TeachersSection`（トップページ用、先頭 N 名表示）と
 * `TeachersGridSection`（一覧ページ用、フィルター・ソート対応）の両方で参照する。
 */

import type { Teacher } from '@/types/teacher';

export const teachers: Teacher[] = [
  {
    id: 'sarah',
    name: 'Sarah Johnson',
    nameJapanese: 'サラ・ジョンソン',
    nationality: 'アメリカ',
    photo:
      'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
    specialization: ['日常英会話', 'ビジネス英語', 'TOEIC対策'],
    experience: '8年',
    introduction:
      'こんにちは！アメリカ出身のサラです。日本に住んで5年になります。皆さんが楽しく英語を学べるよう、一人ひとりに合わせたレッスンを心がけています。',
    languages: ['英語（ネイティブ）', '日本語（上級）', 'スペイン語（中級）'],
    certifications: ['TESOL', 'TOEIC 990点'],
    hobbies: ['料理', '映画鑑賞', '旅行'],
    teachingStyle:
      'フレンドリーで楽しい雰囲気を大切にし、間違いを恐れずに話せる環境作りを心がけています。',
    featured: true,
    rating: 4.9,
    reviewCount: 127,
  },
  {
    id: 'james',
    name: 'James Wilson',
    nameJapanese: 'ジェームス・ウィルソン',
    nationality: 'イギリス',
    photo:
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
    specialization: ['発音矯正', 'イギリス英語', 'プレゼンテーション'],
    experience: '6年',
    introduction:
      'イギリス出身のジェームスです。正しい発音と自然な表現を身につけたい方、ぜひ一緒に学びましょう！',
    languages: ['英語（ネイティブ）', '日本語（中級）', 'フランス語（初級）'],
    certifications: ['CELTA', 'Cambridge English Teaching'],
    hobbies: ['音楽', 'サッカー', '読書'],
    teachingStyle:
      '発音とイントネーションに重点を置き、実践的なコミュニケーション能力の向上を目指します。',
    featured: false,
    rating: 4.8,
    reviewCount: 89,
  },
  {
    id: 'emma',
    name: 'Emma Thompson',
    nameJapanese: 'エマ・トンプソン',
    nationality: 'カナダ',
    photo:
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
    specialization: ['キッズ英語', '初心者向け', '文法基礎'],
    experience: '4年',
    introduction:
      'カナダ出身のエマです。英語が初めての方でも安心して学べるよう、基礎からしっかりサポートします。',
    languages: ['英語（ネイティブ）', '日本語（中級）'],
    certifications: ['TEFL', 'Child Development Certificate'],
    hobbies: ['アート', 'ヨガ', 'ガーデニング'],
    teachingStyle:
      '優しく丁寧な指導で、基礎からしっかりと英語力を身につけられるようサポートします。',
    featured: false,
    rating: 4.7,
    reviewCount: 64,
  },
  {
    id: 'michael',
    name: 'Michael Brown',
    nameJapanese: 'マイケル・ブラウン',
    nationality: 'オーストラリア',
    photo:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
    specialization: ['ビジネス英語', 'IELTS対策', '上級者向け'],
    experience: '10年',
    introduction:
      'オーストラリア出身のマイケルです。ビジネスシーンで使える実践的な英語を一緒に学びましょう！',
    languages: ['英語（ネイティブ）', '日本語（上級）', '中国語（初級）'],
    certifications: ['TESOL', 'IELTS Examiner', 'Business English Certificate'],
    hobbies: ['サーフィン', 'カメラ', 'コーヒー'],
    teachingStyle:
      'ビジネス経験を活かした実践的なレッスンで、即戦力となる英語力を身につけます。',
    featured: true,
    rating: 4.9,
    reviewCount: 156,
  },
  {
    id: 'lisa',
    name: 'Lisa Davis',
    nameJapanese: 'リサ・デイビス',
    nationality: 'アメリカ',
    photo:
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
    specialization: ['TOEFL対策', '留学準備', 'アカデミック英語'],
    experience: '7年',
    introduction:
      'アメリカの大学で言語学を学んだリサです。留学や進学を目指す方のサポートが得意です。',
    languages: ['英語（ネイティブ）', '日本語（中級）', 'ドイツ語（初級）'],
    certifications: ['TESOL', 'TOEFL iBT Instructor'],
    hobbies: ['言語学習', 'ハイキング', '写真'],
    teachingStyle:
      'アカデミックな英語力向上に重点を置き、論理的思考力も同時に育成します。',
    featured: false,
    rating: 4.8,
    reviewCount: 73,
  },
  {
    id: 'david',
    name: 'David Miller',
    nameJapanese: 'デイビッド・ミラー',
    nationality: 'イギリス',
    photo:
      'https://images.unsplash.com/photo-1560250097-0b93528c311a?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
    specialization: ['英文法', '英作文', 'Cambridge試験対策'],
    experience: '9年',
    introduction:
      'イギリス出身のデイビッドです。文法や英作文を通じて、正確で美しい英語を身につけましょう。',
    languages: ['英語（ネイティブ）', '日本語（上級）', 'イタリア語（中級）'],
    certifications: ['CELTA', 'Cambridge ESOL Examiner'],
    hobbies: ['文学', 'クラシック音楽', 'チェス'],
    teachingStyle:
      '文法の基礎を重視し、正確で洗練された英語表現力の習得を目指します。',
    featured: false,
    rating: 4.6,
    reviewCount: 92,
  },
];
