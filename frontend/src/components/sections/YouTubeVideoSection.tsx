/**
 * YouTube Video Section Component
 * YouTube動画セクションコンポーネント（レッスン風景、講師紹介、カフェ紹介動画）
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { Container, Card, Button, Badge } from '@/components/ui';
import { YouTubeEmbed } from '@/components/ui/YouTubeEmbed';
import { VideoCard } from '@/components/ui/VideoCard';
import { VideoGallery } from '@/components/ui/VideoGallery';
import { getFeaturedVideos, getVideosByCategory, videoSections } from '@/data/videos';
import { VideoContent, VIDEO_CATEGORIES } from '@/types/video';
import { cn } from '@/utils/cn';

interface YouTubeVideoSectionProps {
  className?: string;
  variant?: 'default' | 'compact' | 'featured';
  maxVideos?: number;
}

export function YouTubeVideoSection({ 
  className, 
  variant = 'default',
  maxVideos = 6
}: YouTubeVideoSectionProps) {
  const [selectedVideo, setSelectedVideo] = useState<VideoContent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // 注目動画の取得
  const featuredVideos = getFeaturedVideos().slice(0, maxVideos);

  const handleVideoClick = (video: VideoContent) => {
    setSelectedVideo(video);
  };

  // コンパクト版の表示
  if (variant === 'compact') {
    return (
      <div className={cn('space-y-6', className)}>
        <h3 className="text-xl font-bold text-gray-900">動画で見る英会話カフェ</h3>
        <div className="grid md:grid-cols-2 gap-6">
          {featuredVideos.slice(0, 2).map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              size="medium"
              onClick={handleVideoClick}
              showCategory={false}
              showTags={false}
            />
          ))}
        </div>
      </div>
    );
  }

  // 注目動画のみ表示
  if (variant === 'featured') {
    return (
      <section ref={sectionRef} className={cn('py-20 bg-white', className)}>
        <Container>
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              動画で見る英会話カフェ
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              実際のレッスンの様子や講師の紹介動画をご覧ください
            </p>
          </div>

          <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-8">
            {featuredVideos.map((video, index) => (
              <div
                key={video.id}
                className={cn(
                  'transition-all duration-300',
                  isVisible 
                    ? 'translate-y-0 opacity-100' 
                    : 'translate-y-8 opacity-0'
                )}
                style={{ transitionDelay: `${index * 200}ms` }}
              >
                <VideoCard
                  video={video}
                  size="medium"
                  onClick={handleVideoClick}
                  showCategory={true}
                  showTags={false}
                />
              </div>
            ))}
          </div>

          {/* もっと見るボタン */}
          <div className="text-center mt-12">
            <Button size="lg" variant="outline" asChild>
              <a href="/videos">すべての動画を見る</a>
            </Button>
          </div>
        </Container>
      </section>
    );
  }

  // デフォルト版（フル機能）
  return (
    <section ref={sectionRef} className={cn('py-20 bg-gray-50', className)}>
      <Container>
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            動画ギャラリー
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            レッスンの様子、講師紹介、カフェの雰囲気など、様々な動画をご覧いただけます
          </p>
        </div>

        {/* 動画ギャラリー */}
        <VideoGallery
          sections={videoSections.slice(0, 2)} // 最初の2セクションのみ表示
          showCategories={false}
          showSearch={false}
          showFilters={false}
        />

        {/* CTA */}
        <div className="mt-16 text-center">
          <div className="bg-white rounded-2xl p-8 shadow-sm">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              実際のレッスンを体験してみませんか？
            </h3>
            <p className="text-gray-600 mb-6">
              動画でご覧いただいた雰囲気を、ぜひ実際に体験してください
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild>
                <a href="/contact">無料体験レッスンを予約</a>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <a href="/lessons">レッスン詳細を見る</a>
              </Button>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}