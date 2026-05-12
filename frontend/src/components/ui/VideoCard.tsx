/**
 * Video Card Component
 * 動画カードコンポーネント
 */

'use client';

import { useState } from 'react';
import Image from 'next/image';
import { VideoContent, VIDEO_CATEGORIES } from '@/types/video';
import { getYouTubeThumbnail } from '@/components/ui/YouTubeEmbed';
import { cn } from '@/utils/cn';

interface VideoCardProps {
  video: VideoContent;
  size?: 'small' | 'medium' | 'large';
  showDescription?: boolean;
  showTags?: boolean;
  showCategory?: boolean;
  onClick?: (video: VideoContent) => void;
  className?: string;
}

export function VideoCard({
  video,
  size = 'medium',
  showDescription = true,
  showTags = true,
  showCategory = true,
  onClick,
  className
}: VideoCardProps) {
  const [imageError, setImageError] = useState(false);
  
  const categoryInfo = VIDEO_CATEGORIES[video.category];
  
  // サイズ別のスタイル
  const sizeStyles = {
    small: {
      container: 'max-w-sm',
      image: 'h-32',
      title: 'text-sm font-medium',
      description: 'text-xs',
      tag: 'text-xs px-2 py-1'
    },
    medium: {
      container: 'max-w-md',
      image: 'h-48',
      title: 'text-base font-semibold',
      description: 'text-sm',
      tag: 'text-xs px-2 py-1'
    },
    large: {
      container: 'max-w-lg',
      image: 'h-64',
      title: 'text-lg font-bold',
      description: 'text-base',
      tag: 'text-sm px-3 py-1'
    }
  };

  const styles = sizeStyles[size];

  const handleClick = () => {
    onClick?.(video);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      className={cn(
        'bg-white rounded-lg shadow-md overflow-hidden transition-all duration-300 hover:shadow-lg hover:scale-105',
        styles.container,
        onClick && 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
        className
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? 'button' : undefined}
      aria-label={onClick ? `動画を再生: ${video.title}` : undefined}
    >
      {/* サムネイル */}
      <div className={cn('relative overflow-hidden bg-gray-200', styles.image)}>
        {!imageError ? (
          <Image
            src={getYouTubeThumbnail(video.videoId, 'high')}
            alt={video.title}
            fill
            className="object-cover transition-transform duration-300 hover:scale-110"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <svg className="w-12 h-12 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
          </div>
        )}
        
        {/* 再生ボタンオーバーレイ */}
        {onClick && (
          <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 transition-all duration-300 flex items-center justify-center">
            <div className="bg-white bg-opacity-90 rounded-full p-3 transform scale-0 hover:scale-100 transition-transform duration-300">
              <svg className="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
          </div>
        )}

        {/* カテゴリーバッジ */}
        {showCategory && (
          <div className="absolute top-2 left-2">
            <span className={cn(
              'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-white',
              `bg-${categoryInfo.color}-500`
            )}>
              <span>{categoryInfo.icon}</span>
              <span>{categoryInfo.label}</span>
            </span>
          </div>
        )}

        {/* 注目バッジ */}
        {video.featured && (
          <div className="absolute top-2 right-2">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-500 text-white">
              ⭐ 注目
            </span>
          </div>
        )}
      </div>

      {/* コンテンツ */}
      <div className="p-4">
        {/* タイトル */}
        <h3 className={cn(styles.title, 'text-gray-900 mb-2 line-clamp-2')}>
          {video.title}
        </h3>

        {/* 説明文 */}
        {showDescription && video.description && (
          <p className={cn(styles.description, 'text-gray-600 mb-3 line-clamp-3')}>
            {video.description}
          </p>
        )}

        {/* タグ */}
        {showTags && video.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {video.tags.slice(0, 3).map((tag, index) => (
              <span
                key={index}
                className={cn(
                  styles.tag,
                  'bg-gray-100 text-gray-700 rounded-full font-medium'
                )}
              >
                {tag}
              </span>
            ))}
            {video.tags.length > 3 && (
              <span className={cn(styles.tag, 'text-gray-500')}>
                +{video.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* メタ情報 */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            {video.publishedAt.toLocaleDateString('ja-JP', {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            })}
          </span>
          {video.duration && (
            <span>
              {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// 動画カードのスケルトンローディング
export function VideoCardSkeleton({ size = 'medium' }: { size?: 'small' | 'medium' | 'large' }) {
  const sizeStyles = {
    small: 'h-32',
    medium: 'h-48',
    large: 'h-64'
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden animate-pulse">
      <div className={cn('bg-gray-200', sizeStyles[size])} />
      <div className="p-4">
        <div className="h-4 bg-gray-200 rounded mb-2" />
        <div className="h-3 bg-gray-200 rounded mb-3 w-3/4" />
        <div className="flex gap-2 mb-3">
          <div className="h-6 bg-gray-200 rounded-full w-16" />
          <div className="h-6 bg-gray-200 rounded-full w-20" />
        </div>
        <div className="h-3 bg-gray-200 rounded w-1/2" />
      </div>
    </div>
  );
}