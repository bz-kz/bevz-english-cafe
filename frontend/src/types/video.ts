/**
 * Video Content Types
 * 動画コンテンツの型定義
 */

export interface VideoContent {
  id: string;
  title: string;
  description: string;
  videoId: string; // YouTube video ID
  thumbnail?: string;
  category: VideoCategory;
  tags: string[];
  duration?: number; // 秒数
  publishedAt: Date;
  isActive: boolean;
  order: number; // 表示順序
  featured: boolean; // 注目動画かどうか
}

export type VideoCategory = 
  | 'instructor-introduction' // 講師紹介
  | 'lesson-scene' // レッスン風景
  | 'cafe-introduction' // カフェ紹介
  | 'student-testimonial' // 生徒の声
  | 'event' // イベント
  | 'other'; // その他

export interface VideoSection {
  id: string;
  title: string;
  description?: string;
  category: VideoCategory;
  videos: VideoContent[];
  layout: 'grid' | 'carousel' | 'featured';
  maxVideos?: number; // 表示する最大動画数
}

export interface VideoGalleryProps {
  sections: VideoSection[];
  showCategories?: boolean;
  showSearch?: boolean;
  showFilters?: boolean;
}

export interface VideoCardProps {
  video: VideoContent;
  size?: 'small' | 'medium' | 'large';
  showDescription?: boolean;
  showTags?: boolean;
  onClick?: (video: VideoContent) => void;
}

export interface VideoPlayerProps {
  video: VideoContent;
  autoplay?: boolean;
  onClose?: () => void;
}

// 動画カテゴリーの表示名とアイコン
export const VIDEO_CATEGORIES = {
  'instructor-introduction': {
    label: '講師紹介',
    icon: '👨‍🏫',
    color: 'blue'
  },
  'lesson-scene': {
    label: 'レッスン風景',
    icon: '📚',
    color: 'green'
  },
  'cafe-introduction': {
    label: 'カフェ紹介',
    icon: '☕',
    color: 'amber'
  },
  'student-testimonial': {
    label: '生徒の声',
    icon: '💬',
    color: 'purple'
  },
  'event': {
    label: 'イベント',
    icon: '🎉',
    color: 'pink'
  },
  'other': {
    label: 'その他',
    icon: '📹',
    color: 'gray'
  }
} as const;