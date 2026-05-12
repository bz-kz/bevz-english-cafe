/**
 * Performance Provider
 * パフォーマンス最適化のためのプロバイダー
 */

'use client';

import { createContext, useContext, useEffect, ReactNode } from 'react';
import { PerformanceMonitor, ResourceMonitor, MemoryMonitor } from '@/utils/performance';
import { preloadCriticalComponents } from '@/utils/dynamicImports';
import { ImageCache } from '@/utils/cache';
import { ApplicationMonitoring } from '@/utils/monitoring';

interface PerformanceContextType {
  preloadImages: (sources: string[]) => Promise<void>;
  preloadComponents: () => void;
}

const PerformanceContext = createContext<PerformanceContextType | undefined>(undefined);

export function usePerformance() {
  const context = useContext(PerformanceContext);
  if (!context) {
    throw new Error('usePerformance must be used within a PerformanceProvider');
  }
  return context;
}

interface PerformanceProviderProps {
  children: ReactNode;
}

export function PerformanceProvider({ children }: PerformanceProviderProps) {
  useEffect(() => {
    // パフォーマンス監視の初期化
    if (typeof window !== 'undefined') {
      // 統合監視システムの初期化
      ApplicationMonitoring.init();
      
      // Core Web Vitals の監視開始
      PerformanceMonitor.init();
      
      // リソース読み込み時間の測定
      ResourceMonitor.measureResourceTiming();
      
      // メモリ監視の開始
      MemoryMonitor.startMonitoring();
      
      // 重要なコンポーネントのプリロード
      preloadCriticalComponents();
      
      // 重要な画像のプリロード（一時的に無効化してリクエスト中断を防ぐ）
      const criticalImages: string[] = [
        // 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80', // hero_main
        // 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80', // teacher_female_1
        // 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80', // teacher_male_1
      ];
      
      // ImageCache.preloadMultiple(criticalImages).catch(console.error);
      
      // Service Worker の登録（PWA対応）
      if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('SW registered: ', registration);
          })
          .catch((registrationError) => {
            console.log('SW registration failed: ', registrationError);
          });
      }
      
      // ページの可視性変更時の処理
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          // ページが非表示になった時の処理
          MemoryMonitor.monitor();
        } else {
          // ページが表示された時の処理
          preloadCriticalComponents();
        }
      });
      
      // ネットワーク状態の監視
      if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        
        const handleConnectionChange = () => {
          const effectiveType = connection.effectiveType;
          
          // 低速回線の場合は画像品質を下げる
          if (effectiveType === 'slow-2g' || effectiveType === '2g') {
            document.documentElement.classList.add('low-bandwidth');
          } else {
            document.documentElement.classList.remove('low-bandwidth');
          }
        };
        
        connection.addEventListener('change', handleConnectionChange);
        handleConnectionChange(); // 初期実行
      }
    }
    
    return () => {
      // クリーンアップ
      PerformanceMonitor.cleanup();
    };
  }, []);

  const preloadImages = async (sources: string[]): Promise<void> => {
    try {
      await ImageCache.preloadMultiple(sources);
    } catch (error) {
      console.error('Failed to preload images:', error);
    }
  };

  const preloadComponents = (): void => {
    preloadCriticalComponents();
  };

  const value: PerformanceContextType = {
    preloadImages,
    preloadComponents,
  };

  return (
    <PerformanceContext.Provider value={value}>
      {children}
    </PerformanceContext.Provider>
  );
}

// パフォーマンス最適化のためのカスタムフック
export function useImagePreloader() {
  const { preloadImages } = usePerformance();
  
  const preloadOnHover = (sources: string[]) => {
    return {
      onMouseEnter: () => preloadImages(sources),
      onFocus: () => preloadImages(sources),
    };
  };
  
  return { preloadOnHover };
}

// 遅延読み込みのためのカスタムフック
export function useLazyLoading() {
  useEffect(() => {
    // Intersection Observer を使用した遅延読み込み
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const target = entry.target as HTMLElement;
            
            // data-src 属性がある場合は画像を読み込み
            if (target.dataset.src) {
              const img = target as HTMLImageElement;
              img.src = target.dataset.src;
              img.removeAttribute('data-src');
              observer.unobserve(target);
            }
            
            // data-component 属性がある場合はコンポーネントを読み込み
            if (target.dataset.component) {
              // 動的インポートの実行
              import(`@/components/${target.dataset.component}`)
                .then((module) => {
                  // コンポーネントの読み込み完了
                  target.removeAttribute('data-component');
                  observer.unobserve(target);
                })
                .catch(console.error);
            }
          }
        });
      },
      {
        rootMargin: '50px',
        threshold: 0.1,
      }
    );
    
    // 遅延読み込み対象の要素を監視
    const lazyElements = document.querySelectorAll('[data-src], [data-component]');
    lazyElements.forEach((el) => observer.observe(el));
    
    return () => observer.disconnect();
  }, []);
}