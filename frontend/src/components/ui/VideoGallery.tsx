/**
 * Video Gallery Component
 * 動画ギャラリーコンポーネント
 */

'use client';

import { useState, useMemo } from 'react';
import { VideoContent, VIDEO_CATEGORIES } from '@/types/video';
import type { VideoSection } from '@/types/video';
import { VideoCard, VideoCardSkeleton } from '@/components/ui/VideoCard';
import { YouTubeEmbed } from '@/components/ui/YouTubeEmbed';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

interface VideoGalleryProps {
  sections: VideoSection[];
  showCategories?: boolean;
  showSearch?: boolean;
  showFilters?: boolean;
  className?: string;
}

export function VideoGallery({
  sections,
  showCategories = true,
  showSearch = true,
  showFilters = true,
  className
}: VideoGalleryProps) {
  const [selectedVideo, setSelectedVideo] = useState<VideoContent | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);

  // 全動画を取得
  const allVideos = useMemo(() => {
    return sections.flatMap(section => section.videos);
  }, [sections]);

  // フィルタリングされた動画
  const filteredVideos = useMemo(() => {
    let videos = allVideos;

    // カテゴリーフィルター
    if (selectedCategory !== 'all') {
      videos = videos.filter(video => video.category === selectedCategory);
    }

    // 検索フィルター
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      videos = videos.filter(video =>
        video.title.toLowerCase().includes(query) ||
        video.description.toLowerCase().includes(query) ||
        video.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    return videos;
  }, [allVideos, selectedCategory, searchQuery]);

  // カテゴリー一覧
  const categories = useMemo(() => {
    const categorySet = new Set(allVideos.map(video => video.category));
    return Array.from(categorySet);
  }, [allVideos]);

  const handleVideoClick = (video: VideoContent) => {
    setSelectedVideo(video);
  };

  const handleCloseModal = () => {
    setSelectedVideo(null);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
  };

  return (
    <div className={cn('space-y-8', className)}>
      {/* 検索・フィルター */}
      {(showSearch || showFilters) && (
        <div className="space-y-4">
          {/* 検索バー */}
          {showSearch && (
            <div className="max-w-md">
              <Input
                type="text"
                placeholder="動画を検索..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full"
                icon={
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                }
              />
            </div>
          )}

          {/* カテゴリーフィルター */}
          {showFilters && showCategories && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedCategory === 'all' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => handleCategoryChange('all')}
              >
                すべて
              </Button>
              {categories.map(category => {
                const categoryInfo = VIDEO_CATEGORIES[category];
                return (
                  <Button
                    key={category}
                    variant={selectedCategory === category ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => handleCategoryChange(category)}
                    className="flex items-center gap-1"
                  >
                    <span>{categoryInfo.icon}</span>
                    <span>{categoryInfo.label}</span>
                  </Button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 検索結果表示 */}
      {(searchQuery || selectedCategory !== 'all') && (
        <div className="text-sm text-gray-600">
          {filteredVideos.length}件の動画が見つかりました
          {searchQuery && (
            <span> 「{searchQuery}」の検索結果</span>
          )}
        </div>
      )}

      {/* 動画セクション */}
      {searchQuery || selectedCategory !== 'all' ? (
        // 検索・フィルター結果表示
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">検索結果</h2>
          {filteredVideos.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredVideos.map(video => (
                <VideoCard
                  key={video.id}
                  video={video}
                  onClick={handleVideoClick}
                  showCategory={true}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <p className="text-gray-500 text-lg">該当する動画が見つかりませんでした</p>
              <p className="text-gray-400 text-sm mt-2">検索条件を変更してお試しください</p>
            </div>
          )}
        </div>
      ) : (
        // セクション別表示
        sections.map(section => (
          <VideoSection
            key={section.id}
            section={section}
            onVideoClick={handleVideoClick}
            isLoading={isLoading}
          />
        ))
      )}

      {/* 動画モーダル */}
      {selectedVideo && (
        <VideoModal
          video={selectedVideo}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}

// 動画セクションコンポーネント
interface VideoSectionProps {
  section: VideoSection;
  onVideoClick: (video: VideoContent) => void;
  isLoading?: boolean;
}

function VideoSection({ section, onVideoClick, isLoading = false }: VideoSectionProps) {
  const [showAll, setShowAll] = useState(false);
  
  const displayVideos = showAll ? section.videos : section.videos.slice(0, section.maxVideos || 4);
  const hasMore = section.videos.length > (section.maxVideos || 4);

  if (section.videos.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* セクションヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span>{VIDEO_CATEGORIES[section.category].icon}</span>
            <span>{section.title}</span>
          </h2>
          {section.description && (
            <p className="text-gray-600 mt-1">{section.description}</p>
          )}
        </div>
        {hasMore && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? '少なく表示' : 'すべて表示'}
          </Button>
        )}
      </div>

      {/* 動画グリッド */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <VideoCardSkeleton key={index} />
          ))}
        </div>
      ) : (
        <div className={cn(
          'grid gap-6',
          section.layout === 'carousel' 
            ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
            : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
        )}>
          {displayVideos.map(video => (
            <VideoCard
              key={video.id}
              video={video}
              onClick={onVideoClick}
              showCategory={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// 動画モーダルコンポーネント
interface VideoModalProps {
  video: VideoContent;
  onClose: () => void;
}

function VideoModal({ video, onClose }: VideoModalProps) {
  return (
    <Modal isOpen={true} onClose={onClose} size="xl">
      <div className="space-y-4">
        {/* 動画プレーヤー */}
        <div className="aspect-video">
          <YouTubeEmbed
            videoId={video.videoId}
            title={video.title}
            autoplay={true}
            className="w-full h-full"
          />
        </div>

        {/* 動画情報 */}
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <h2 className="text-xl font-bold text-gray-900 flex-1 pr-4">
              {video.title}
            </h2>
            <div className="flex items-center gap-2">
              <span className={cn(
                'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-white',
                `bg-${VIDEO_CATEGORIES[video.category].color}-500`
              )}>
                <span>{VIDEO_CATEGORIES[video.category].icon}</span>
                <span>{VIDEO_CATEGORIES[video.category].label}</span>
              </span>
              {video.featured && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-500 text-white">
                  ⭐ 注目
                </span>
              )}
            </div>
          </div>

          <p className="text-gray-600 leading-relaxed">
            {video.description}
          </p>

          {/* タグ */}
          {video.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {video.tags.map((tag, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* メタ情報 */}
          <div className="flex items-center justify-between text-sm text-gray-500 pt-2 border-t">
            <span>
              公開日: {video.publishedAt.toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </span>
            {video.duration && (
              <span>
                再生時間: {Math.floor(video.duration / 60)}分{video.duration % 60}秒
              </span>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}