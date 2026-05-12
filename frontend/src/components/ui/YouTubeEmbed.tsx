/**
 * YouTube Embed Component
 * YouTube動画埋め込みコンポーネント（レスポンシブ対応）
 */

'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/utils/cn';

interface YouTubeEmbedProps {
  videoId: string;
  title: string;
  autoplay?: boolean;
  controls?: boolean;
  mute?: boolean;
  loop?: boolean;
  start?: number; // 開始時間（秒）
  end?: number; // 終了時間（秒）
  className?: string;
  aspectRatio?: '16/9' | '4/3' | '1/1';
  showInfo?: boolean;
  allowFullscreen?: boolean;
  privacy?: boolean; // youtube-nocookie.comを使用するか
  onReady?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnd?: () => void;
}

export function YouTubeEmbed({
  videoId,
  title,
  autoplay = false,
  controls = true,
  mute = false,
  loop = false,
  start,
  end,
  className,
  aspectRatio = '16/9',
  showInfo = true,
  allowFullscreen = true,
  privacy = true,
  onReady,
  onPlay,
  onPause,
  onEnd
}: YouTubeEmbedProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // YouTube埋め込みURL生成
  const generateEmbedUrl = () => {
    const baseUrl = privacy 
      ? 'https://www.youtube-nocookie.com/embed/' 
      : 'https://www.youtube.com/embed/';
    
    const params = new URLSearchParams();
    
    if (autoplay) params.set('autoplay', '1');
    if (!controls) params.set('controls', '0');
    if (mute) params.set('mute', '1');
    if (loop) {
      params.set('loop', '1');
      params.set('playlist', videoId); // ループには playlist パラメータが必要
    }
    if (start) params.set('start', start.toString());
    if (end) params.set('end', end.toString());
    if (!showInfo) params.set('showinfo', '0');
    if (!allowFullscreen) params.set('fs', '0');
    
    // プライバシー強化モード
    params.set('rel', '0'); // 関連動画を同じチャンネルのみに制限
    params.set('modestbranding', '1'); // YouTubeロゴを最小化
    
    return `${baseUrl}${videoId}?${params.toString()}`;
  };

  // アスペクト比のクラス
  const aspectRatioClass = {
    '16/9': 'aspect-video',
    '4/3': 'aspect-[4/3]',
    '1/1': 'aspect-square'
  };

  // YouTube動画の存在確認
  useEffect(() => {
    const checkVideoExists = async () => {
      try {
        // YouTube oEmbed APIで動画の存在確認
        const response = await fetch(
          `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
        );
        
        if (response.ok) {
          setIsLoaded(true);
          onReady?.();
        } else {
          setHasError(true);
        }
      } catch (error) {
        console.error('YouTube video check failed:', error);
        setHasError(true);
      }
    };

    if (videoId) {
      checkVideoExists();
    }
  }, [videoId, onReady]);

  // エラー状態の表示
  if (hasError) {
    return (
      <div className={cn(
        'bg-gray-100 rounded-lg flex items-center justify-center',
        aspectRatioClass[aspectRatio],
        className
      )}>
        <div className="text-center text-gray-500 p-6">
          <svg className="w-12 h-12 mx-auto mb-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <p className="font-medium">動画を読み込めませんでした</p>
          <p className="text-sm mt-1">動画が削除されているか、一時的に利用できません</p>
        </div>
      </div>
    );
  }

  // ローディング状態の表示
  if (!isLoaded) {
    return (
      <div className={cn(
        'bg-gray-100 rounded-lg flex items-center justify-center animate-pulse',
        aspectRatioClass[aspectRatio],
        className
      )}>
        <div className="text-center text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
          <p className="text-sm">動画を読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      'relative overflow-hidden rounded-lg shadow-lg',
      aspectRatioClass[aspectRatio],
      className
    )}>
      <iframe
        src={generateEmbedUrl()}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen={allowFullscreen}
        className="absolute inset-0 w-full h-full border-0"
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
      />
      
      {/* オーバーレイ（必要に応じて） */}
      <div className="absolute inset-0 pointer-events-none">
        {/* グラデーションオーバーレイなどをここに追加可能 */}
      </div>
    </div>
  );
}

// YouTube動画情報を取得するヘルパー関数
export const getYouTubeVideoInfo = async (videoId: string) => {
  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    );
    
    if (response.ok) {
      const data = await response.json();
      return {
        title: data.title,
        author: data.author_name,
        thumbnail: data.thumbnail_url,
        duration: null, // oEmbed APIでは取得できない
        width: data.width,
        height: data.height
      };
    }
    
    return null;
  } catch (error) {
    console.error('Failed to fetch YouTube video info:', error);
    return null;
  }
};

// YouTube動画IDをURLから抽出するヘルパー関数
export const extractYouTubeVideoId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
};

// YouTube動画のサムネイル取得
export const getYouTubeThumbnail = (videoId: string, quality: 'default' | 'medium' | 'high' | 'standard' | 'maxres' = 'high') => {
  return `https://img.youtube.com/vi/${videoId}/${quality === 'high' ? 'hqdefault' : quality === 'medium' ? 'mqdefault' : quality === 'standard' ? 'sddefault' : quality === 'maxres' ? 'maxresdefault' : 'default'}.jpg`;
};