/**
 * Lesson Videos Component
 * レッスン関連動画表示コンポーネント
 */

'use client';

import { useMemo } from 'react';
import { Card } from '@/components/ui';
import { VideoCard } from '@/components/ui/VideoCard';
import { videoContents } from '@/data/videos';
import { VideoContent } from '@/types/video';

interface LessonVideosProps {
  lessonType: string;
  lessonTitle: string;
  className?: string;
}

export function LessonVideos({ lessonType, lessonTitle, className }: LessonVideosProps) {
  // レッスン関連動画を取得
  const lessonVideos = useMemo(() => {
    return videoContents.filter(video => 
      video.isActive && (
        video.category === 'lesson-scene' ||
        video.tags.some(tag => 
          tag.toLowerCase().includes(lessonType.toLowerCase()) ||
          tag.toLowerCase().includes(lessonTitle.toLowerCase()) ||
          (lessonType === 'group' && tag.toLowerCase().includes('グループ')) ||
          (lessonType === 'private' && tag.toLowerCase().includes('プライベート')) ||
          (lessonType === 'trial' && tag.toLowerCase().includes('体験'))
        )
      )
    );
  }, [lessonType, lessonTitle]);

  // メインレッスン動画（最も関連性の高い動画）
  const mainVideo = useMemo(() => {
    // レッスンタイプに最も関連する動画を探す
    const typeSpecificVideo = lessonVideos.find(video => 
      video.tags.some(tag => 
        tag.toLowerCase().includes(lessonType.toLowerCase()) ||
        (lessonType === 'group' && tag.toLowerCase().includes('グループ')) ||
        (lessonType === 'private' && tag.toLowerCase().includes('プライベート')) ||
        (lessonType === 'trial' && tag.toLowerCase().includes('体験'))
      )
    );
    
    return typeSpecificVideo || lessonVideos[0];
  }, [lessonVideos, lessonType]);

  // その他の関連動画
  const relatedVideos = useMemo(() => {
    return lessonVideos.filter(video => video.id !== mainVideo?.id);
  }, [lessonVideos, mainVideo]);

  if (lessonVideos.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      {/* メインレッスン動画 */}
      {mainVideo && (
        <Card className="p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            レッスン紹介動画
          </h2>
          <p className="text-gray-600 mb-6">
            実際の{lessonTitle}の様子をご覧ください
          </p>
          <VideoCard
            video={mainVideo}
            size="large"
            showCategory={false}
            showTags={true}
            showDescription={true}
          />
        </Card>
      )}

      {/* 関連レッスン動画 */}
      {relatedVideos.length > 0 && (
        <Card className="p-8">
          <h3 className="text-xl font-bold text-gray-900 mb-6">
            関連レッスン動画
          </h3>
          <div className="grid md:grid-cols-2 gap-6">
            {relatedVideos.slice(0, 4).map(video => (
              <VideoCard
                key={video.id}
                video={video}
                size="medium"
                showCategory={false}
                showTags={false}
                showDescription={true}
              />
            ))}
          </div>
          
          {relatedVideos.length > 4 && (
            <div className="mt-6 text-center">
              <a
                href="/videos"
                className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium"
              >
                すべてのレッスン動画を見る
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}