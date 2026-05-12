/**
 * 画像URL定数
 * 確実に動作するUnsplash画像URLを管理
 */

// 確実に動作するUnsplash画像URL
export const RELIABLE_IMAGES = {
  // カフェ・学習環境
  cafe_interior: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  cafe_atmosphere: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  
  // レッスン風景
  lesson_scene: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  group_lesson: 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  private_lesson: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  business_lesson: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  online_lesson: 'https://images.unsplash.com/photo-1588196749597-9ff075ee6b5b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  
  // 講師・人物
  teacher_female_1: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
  teacher_male_1: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
  teacher_female_2: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
  teacher_male_2: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
  teacher_female_3: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
  teacher_male_3: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
  
  // 学習・勉強
  study_scene: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  learning_materials: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  
  // ヒーロー・CTA
  hero_main: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
  cta_scene: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  
  // 代替画像（問題のあったURLの代替）
  students_conversation: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
} as const;

// プレースホルダー画像（開発用）
export const PLACEHOLDER_IMAGES = {
  person: 'https://via.placeholder.com/400x400/6366f1/ffffff?text=Person',
  lesson: 'https://via.placeholder.com/800x600/6366f1/ffffff?text=Lesson',
  cafe: 'https://via.placeholder.com/800x600/6366f1/ffffff?text=Cafe',
} as const;

// 画像の種類
export type ImageType = keyof typeof RELIABLE_IMAGES;
export type PlaceholderType = keyof typeof PLACEHOLDER_IMAGES;

/**
 * 確実に動作する画像URLを取得
 */
export function getReliableImageUrl(type: ImageType): string {
  return RELIABLE_IMAGES[type];
}

/**
 * プレースホルダー画像URLを取得
 */
export function getPlaceholderImageUrl(type: PlaceholderType): string {
  return PLACEHOLDER_IMAGES[type];
}