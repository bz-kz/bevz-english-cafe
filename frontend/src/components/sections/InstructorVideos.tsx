/**
 * Instructor Videos Component
 * 講師関連動画表示コンポーネント
 */

'use client';

import { useMemo } from 'react';
import { Card } from '@/components/ui';
import { VideoCard } from '@/components/ui/VideoCard';
import { VideoGallery } from '@/components/ui/VideoGallery';
import { videoContents } from '@/data/videos';
import { VideoContent, VideoSection } from '@/types/video';

interface InstructorVideosProps {
  teacherId: string;
  teacherName: string;
  className?: string;
}

export function InstructorVideos({ teacherId, teacherName, className }: InstructorVideosProps) {
  // 講師関連動画を取得
  const instructorVideos = useMemo(() => {
    return videoContents.filter(video => 
      video.isActive && (
        video.category === 'instructor-introduction' ||
        video.tags.some(tag => 
          tag.toLowerCase().includes(teacherId.toLowerCase()) ||
          tag.toLowerCase().includes(teacherName.toLowerCase())
        )
      )
    );
  }, [teacherId, teacherName]);

  // 講師の紹介動画（メイン動画）
  const mainVideo = useMemo(() => {
    return instructorVideos.find(video => 
      video.tags.some(tag => 
        tag.toLowerCase().includes(teacherId.toLowerCase())
      )
    ) || instructorVideos[0];
  }, [instructorVideos, teacherId]);

  // その他の関連動画
  const relatedVideos = useMemo(() => {
    return instructorVideos.filter(video => video.id !== mainVideo?.id);
  }, [instructorVideos, mainVideo]);

  if (instructorVideos.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      {/* メイン講師紹介動画 */}
      {mainVideo && (
        <Card className="p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            講師紹介動画
          </h2>
          <p className="text-gray-600 mb-6">
            {teacherName}先生からのメッセージをご覧ください
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

      {/* 関連動画 */}
      {relatedVideos.length > 0 && (
        <Card className="p-8">
          <h3 className="text-xl font-bold text-gray-900 mb-6">
            {teacherName}先生の関連動画
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
                すべての動画を見る
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