/**
 * Video Content Data
 * 動画コンテンツのモックデータ
 */

import { VideoContent, VideoSection } from '@/types/video';

// 動画コンテンツのモックデータ
export const videoContents: VideoContent[] = [
  // 講師紹介動画
  {
    id: 'instructor-sarah',
    title: 'Sarah先生の自己紹介',
    description: 'アメリカ出身のSarah先生が、英語学習のコツや教育への情熱について語ります。初心者の方でも安心して学べる理由をお話しします。',
    videoId: 'dQw4w9WgXcQ', // サンプル動画ID（実際のプロジェクトでは講師の実際の動画IDに変更）
    category: 'instructor-introduction',
    tags: ['講師紹介', 'アメリカ', '初心者向け', 'Sarah', 'sarah'],
    publishedAt: new Date('2024-01-15'),
    isActive: true,
    order: 1,
    featured: true
  },
  {
    id: 'instructor-james',
    title: 'James先生のレッスンスタイル',
    description: 'イギリス出身のJames先生が、楽しく効果的な英会話レッスンの秘訣をご紹介。発音矯正とビジネス英語を得意としています。',
    videoId: 'jNQXAC9IVRw',
    category: 'instructor-introduction',
    tags: ['講師紹介', 'イギリス', 'ビジネス英語', 'James', 'james', '発音矯正'],
    publishedAt: new Date('2024-01-20'),
    isActive: true,
    order: 2,
    featured: true
  },
  {
    id: 'instructor-emma',
    title: 'Emma先生と学ぶ発音のコツ',
    description: 'カナダ出身のEmma先生が、正しい発音のポイントと練習方法を分かりやすく解説します。初心者の方にも優しく指導します。',
    videoId: 'M7lc1UVf-VE',
    category: 'instructor-introduction',
    tags: ['講師紹介', 'カナダ', '発音', 'Emma', 'emma', '初心者向け'],
    publishedAt: new Date('2024-02-01'),
    isActive: true,
    order: 3,
    featured: false
  },

  // レッスン風景動画
  {
    id: 'lesson-group-beginner',
    title: '初心者向けグループレッスンの様子',
    description: '英語を始めたばかりの生徒さんたちが、楽しく基本的な会話を練習している様子をご覧ください。アットホームな雰囲気で学習できます。',
    videoId: 'YQHsXMglC9A',
    category: 'lesson-scene',
    tags: ['グループレッスン', '初心者', '基本会話', '雰囲気', 'group', 'group-conversation'],
    publishedAt: new Date('2024-01-25'),
    isActive: true,
    order: 1,
    featured: true
  },
  {
    id: 'lesson-private-business',
    title: 'ビジネス英語プライベートレッスン',
    description: 'プロフェッショナル向けのマンツーマンレッスンの様子。実際のビジネスシーンで使える表現を集中的に学習します。',
    videoId: 'adLGHcj_fmA',
    category: 'lesson-scene',
    tags: ['プライベートレッスン', 'ビジネス英語', 'マンツーマン', '実践的', 'private', 'private-lesson'],
    publishedAt: new Date('2024-02-05'),
    isActive: true,
    order: 2,
    featured: true
  },
  {
    id: 'lesson-trial-experience',
    title: '無料体験レッスンの流れ',
    description: '初回の無料体験レッスンがどのように進むかをご紹介。レベルチェックから実際のレッスン体験まで詳しく解説します。',
    videoId: 'hFZFjoX2cGg',
    category: 'lesson-scene',
    tags: ['体験レッスン', '無料', 'レベルチェック', '初回', 'trial', 'trial-lesson'],
    publishedAt: new Date('2024-02-10'),
    isActive: true,
    order: 3,
    featured: true
  },
  {
    id: 'lesson-conversation-cafe',
    title: 'カフェスタイル英会話レッスン',
    description: 'リラックスした雰囲気の中で、コーヒーを飲みながら自然な英会話を楽しむレッスンの様子です。',
    videoId: 'kJQP7kiw5Fk',
    category: 'lesson-scene',
    tags: ['カフェスタイル', '英会話', 'リラックス', '自然な会話'],
    publishedAt: new Date('2024-02-15'),
    isActive: true,
    order: 4,
    featured: false
  },

  // カフェ紹介動画
  {
    id: 'cafe-tour',
    title: '英会話カフェ店内ツアー',
    description: '温かみのある店内の様子をご紹介。学習に集中できる環境と、リラックスできる空間の両方を兼ね備えています。',
    videoId: 'LXb3EKWsInQ',
    category: 'cafe-introduction',
    tags: ['店内紹介', '環境', '雰囲気', 'ツアー'],
    publishedAt: new Date('2024-01-10'),
    isActive: true,
    order: 1,
    featured: true
  },
  {
    id: 'cafe-facilities',
    title: '学習設備とサービスのご紹介',
    description: '最新の学習設備、Wi-Fi環境、ドリンクサービスなど、快適に学習していただくための設備をご紹介します。',
    videoId: 'ALZHF5UqnU4',
    category: 'cafe-introduction',
    tags: ['設備', 'サービス', 'Wi-Fi', 'ドリンク'],
    publishedAt: new Date('2024-01-30'),
    isActive: true,
    order: 2,
    featured: false
  },

  // 生徒の声
  {
    id: 'testimonial-yuki',
    title: 'Yukiさんの体験談 - 初心者から中級者へ',
    description: '英語初心者だったYukiさんが、6ヶ月で日常会話ができるようになった体験談をお聞きください。',
    videoId: 'ZXsQAXx_ao0',
    category: 'student-testimonial',
    tags: ['体験談', '初心者', '成長', '6ヶ月'],
    publishedAt: new Date('2024-02-15'),
    isActive: true,
    order: 1,
    featured: true
  },
  {
    id: 'testimonial-hiroshi',
    title: 'Hiroshiさんのビジネス英語成功体験',
    description: 'ビジネス英語を学んで海外出張で活躍されているHiroshiさんの成功体験をご紹介します。',
    videoId: 'Ks-_Mh1QhMc',
    category: 'student-testimonial',
    tags: ['体験談', 'ビジネス英語', '海外出張', '成功'],
    publishedAt: new Date('2024-02-20'),
    isActive: true,
    order: 2,
    featured: false
  },

  // イベント動画
  {
    id: 'event-christmas-party',
    title: 'クリスマスパーティー2023',
    description: '毎年恒例のクリスマスパーティーの様子。生徒さんと講師が一緒に楽しい時間を過ごしました。',
    videoId: 'yXQViqx6GMY',
    category: 'event',
    tags: ['イベント', 'クリスマス', 'パーティー', '2023'],
    publishedAt: new Date('2023-12-25'),
    isActive: true,
    order: 1,
    featured: false
  }
];

// 動画セクションの設定
export const videoSections: VideoSection[] = [
  {
    id: 'featured-videos',
    title: '注目の動画',
    description: '当カフェの魅力を伝える厳選動画をご覧ください',
    category: 'instructor-introduction',
    videos: videoContents.filter(video => video.featured),
    layout: 'carousel',
    maxVideos: 6
  },
  {
    id: 'instructor-videos',
    title: '講師紹介動画',
    description: '経験豊富な講師陣をご紹介します',
    category: 'instructor-introduction',
    videos: videoContents.filter(video => video.category === 'instructor-introduction'),
    layout: 'grid',
    maxVideos: 6
  },
  {
    id: 'lesson-videos',
    title: 'レッスン風景',
    description: '実際のレッスンの様子をご覧ください',
    category: 'lesson-scene',
    videos: videoContents.filter(video => video.category === 'lesson-scene'),
    layout: 'grid',
    maxVideos: 4
  },
  {
    id: 'cafe-videos',
    title: 'カフェ紹介',
    description: '温かみのある学習環境をご紹介',
    category: 'cafe-introduction',
    videos: videoContents.filter(video => video.category === 'cafe-introduction'),
    layout: 'grid',
    maxVideos: 4
  },
  {
    id: 'testimonial-videos',
    title: '生徒さんの声',
    description: '実際に学習された生徒さんの体験談',
    category: 'student-testimonial',
    videos: videoContents.filter(video => video.category === 'student-testimonial'),
    layout: 'grid',
    maxVideos: 4
  }
];

// カテゴリー別動画取得
export const getVideosByCategory = (category: VideoContent['category']) => {
  return videoContents.filter(video => video.category === category && video.isActive);
};

// 注目動画取得
export const getFeaturedVideos = () => {
  return videoContents.filter(video => video.featured && video.isActive);
};

// 動画検索
export const searchVideos = (query: string) => {
  const lowercaseQuery = query.toLowerCase();
  return videoContents.filter(video => 
    video.isActive && (
      video.title.toLowerCase().includes(lowercaseQuery) ||
      video.description.toLowerCase().includes(lowercaseQuery) ||
      video.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery))
    )
  );
};

// 関連動画取得
export const getRelatedVideos = (currentVideo: VideoContent, limit: number = 3) => {
  return videoContents
    .filter(video => 
      video.isActive && 
      video.id !== currentVideo.id && 
      (video.category === currentVideo.category || 
       video.tags.some(tag => currentVideo.tags.includes(tag)))
    )
    .slice(0, limit);
};