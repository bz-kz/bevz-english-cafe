// 共通の型定義 - コンテンツ関連

export interface Teacher {
  id: string;
  name: string;
  photo: string;
  nationality: string;
  languages: string[];
  specialization: string[];
  experience: string;
  introduction: string;
  certifications?: string[];
  isActive: boolean;
}

export interface Lesson {
  id: string;
  title: string;
  description: string;
  type: 'group' | 'private' | 'trial';
  price: {
    amount: number;
    currency: 'JPY';
    period: 'per_lesson' | 'monthly';
  };
  duration: number; // minutes
  maxStudents?: number;
  level: string[];
  features: string[];
  isActive: boolean;
}

export interface Review {
  id: string;
  studentName: string;
  rating: number; // 1-5 stars
  comment: string;
  lessonType: 'group' | 'private' | 'trial';
  teacherId?: string;
  helpfulCount: number;
  verified: boolean;
  isPublished: boolean;
  submittedAt: Date;
}

export interface YouTubeVideo {
  videoId: string;
  title: string;
  description?: string;
  category: 'lesson' | 'teacher' | 'cafe';
}

export interface SNSConfig {
  lineId?: string;
  facebookUrl?: string;
  instagramUrl?: string;
}