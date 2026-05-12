// 共通の設定定数

export const API_ENDPOINTS = {
  CONTACT: '/api/contact',
  TEACHERS: '/api/teachers',
  LESSONS: '/api/lessons',
  REVIEWS: '/api/reviews',
} as const;

export const LESSON_TYPES = {
  GROUP: 'group',
  PRIVATE: 'private',
  TRIAL: 'trial',
  OTHER: 'other',
} as const;

export const CONTACT_METHODS = {
  EMAIL: 'email',
  PHONE: 'phone',
  LINE: 'line',
  FACEBOOK: 'facebook',
  INSTAGRAM: 'instagram',
} as const;

export const CONTACT_STATUS = {
  PENDING: 'pending',
  RESPONDED: 'responded',
  ARCHIVED: 'archived',
} as const;

export const VALIDATION_RULES = {
  NAME_MAX_LENGTH: 100,
  EMAIL_MAX_LENGTH: 255,
  PHONE_MAX_LENGTH: 20,
  MESSAGE_MAX_LENGTH: 2000,
  MESSAGE_MIN_LENGTH: 10,
} as const;

export const BUSINESS_INFO = {
  NAME: '英会話カフェ',
  ADDRESS: '東京都渋谷区...',
  PHONE: '03-1234-5678',
  EMAIL: 'info@english-cafe.com',
  HOURS: {
    WEEKDAY: '10:00-21:00',
    WEEKEND: '10:00-18:00',
  },
} as const;