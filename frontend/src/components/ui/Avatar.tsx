/**
 * Avatar Component
 * ユーザーや講師のアバター表示コンポーネント
 */

'use client';

import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/utils/cn';

interface AvatarProps {
  src?: string;
  alt?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  fallbackClassName?: string;
}

const sizeClasses = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-lg',
  xl: 'w-16 h-16 text-xl',
  '2xl': 'w-20 h-20 text-2xl'
};

export function Avatar({ 
  src, 
  alt, 
  name, 
  size = 'md', 
  className,
  fallbackClassName 
}: AvatarProps) {
  const [imageError, setImageError] = useState(false);

  // 名前からイニシャルを生成
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // 名前から背景色を生成（一貫性のある色）
  const getBackgroundColor = (name: string) => {
    const colors = [
      'bg-red-500',
      'bg-blue-500',
      'bg-green-500',
      'bg-yellow-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-teal-500'
    ];
    
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  };

  const baseClasses = cn(
    'relative inline-flex items-center justify-center rounded-full overflow-hidden',
    sizeClasses[size],
    className
  );

  if (src && !imageError) {
    return (
      <div className={baseClasses}>
        <Image
          src={src}
          alt={alt || name || 'Avatar'}
          fill
          className="object-cover"
          onError={() => setImageError(true)}
        />
      </div>
    );
  }

  // フォールバック表示
  if (name) {
    return (
      <div 
        className={cn(
          baseClasses,
          'text-white font-medium',
          getBackgroundColor(name),
          fallbackClassName
        )}
      >
        {getInitials(name)}
      </div>
    );
  }

  // デフォルトアイコン
  return (
    <div 
      className={cn(
        baseClasses,
        'bg-gray-300 text-gray-600',
        fallbackClassName
      )}
    >
      <svg 
        className="w-1/2 h-1/2" 
        fill="currentColor" 
        viewBox="0 0 20 20"
      >
        <path 
          fillRule="evenodd" 
          d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" 
          clipRule="evenodd" 
        />
      </svg>
    </div>
  );
}

interface AvatarGroupProps {
  avatars: Array<{
    src?: string;
    alt?: string;
    name?: string;
  }>;
  max?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
}

export function AvatarGroup({ 
  avatars, 
  max = 3, 
  size = 'md', 
  className 
}: AvatarGroupProps) {
  const displayAvatars = avatars.slice(0, max);
  const remainingCount = avatars.length - max;

  return (
    <div className={cn('flex -space-x-2', className)}>
      {displayAvatars.map((avatar, index) => (
        <Avatar
          key={index}
          src={avatar.src}
          alt={avatar.alt}
          name={avatar.name}
          size={size}
          className="border-2 border-white"
        />
      ))}
      
      {remainingCount > 0 && (
        <div 
          className={cn(
            'relative inline-flex items-center justify-center rounded-full border-2 border-white bg-gray-100 text-gray-600 font-medium',
            sizeClasses[size]
          )}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
}