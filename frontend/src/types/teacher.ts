/**
 * Teacher type definition
 * 講師情報の型定義
 *
 * frontend display shape; backend has no /teachers endpoint as of Stage B4.
 * Sourced from static marketing data (`@/data/teachers`).
 */

export interface Teacher {
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
