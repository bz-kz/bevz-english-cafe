import { MetadataRoute } from 'next';
import { SITE_CONFIG } from '@/utils/metadata';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = SITE_CONFIG.url;
  
  // 静的ページ
  const staticPages = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 1,
    },
    {
      url: `${baseUrl}/instructors`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/lessons`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/videos`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    },
  ];

  // 講師ページ（実際の実装では API から取得）
  const instructorIds = ['sarah', 'james', 'emily', 'michael'];
  const instructorPages = instructorIds.map(id => ({
    url: `${baseUrl}/instructors/${id}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));

  // レッスンページ（実際の実装では API から取得）
  const lessonIds = ['trial-lesson', 'group-conversation', 'private-lesson', 'business-english'];
  const lessonPages = lessonIds.map(id => ({
    url: `${baseUrl}/lessons/${id}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));

  return [...staticPages, ...instructorPages, ...lessonPages];
}