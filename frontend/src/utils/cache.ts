/**
 * Cache Utilities
 * キャッシュ戦略のユーティリティ
 */

// ブラウザキャッシュの管理
export class BrowserCache {
  private static instance: BrowserCache;
  private cache: Map<string, { data: any; timestamp: number; ttl: number }>;

  private constructor() {
    this.cache = new Map();
  }

  static getInstance(): BrowserCache {
    if (!BrowserCache.instance) {
      BrowserCache.instance = new BrowserCache();
    }
    return BrowserCache.instance;
  }

  // データをキャッシュに保存
  set(key: string, data: any, ttlMinutes: number = 30): void {
    const ttl = ttlMinutes * 60 * 1000; // ミリ秒に変換
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  // キャッシュからデータを取得
  get(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  // キャッシュをクリア
  clear(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  // 期限切れのキャッシュを削除
  cleanup(): void {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    for (const [key, cached] of entries) {
      if (now - cached.timestamp > cached.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

// LocalStorage を使用した永続キャッシュ
export class PersistentCache {
  private static prefix = 'english_cafe_';

  static set(key: string, data: any, ttlMinutes: number = 60): void {
    if (typeof window === 'undefined') return;

    const item = {
      data,
      timestamp: Date.now(),
      ttl: ttlMinutes * 60 * 1000,
    };

    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(item));
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
  }

  static get(key: string): any | null {
    if (typeof window === 'undefined') return null;

    try {
      const item = localStorage.getItem(this.prefix + key);
      if (!item) return null;

      const parsed = JSON.parse(item);
      const now = Date.now();

      if (now - parsed.timestamp > parsed.ttl) {
        localStorage.removeItem(this.prefix + key);
        return null;
      }

      return parsed.data;
    } catch (error) {
      console.warn('Failed to read from localStorage:', error);
      return null;
    }
  }

  static clear(key?: string): void {
    if (typeof window === 'undefined') return;

    if (key) {
      localStorage.removeItem(this.prefix + key);
    } else {
      // プレフィックスが付いたすべてのキーを削除
      const keys = Object.keys(localStorage);
      keys.forEach(k => {
        if (k.startsWith(this.prefix)) {
          localStorage.removeItem(k);
        }
      });
    }
  }

  static cleanup(): void {
    if (typeof window === 'undefined') return;

    const keys = Object.keys(localStorage);
    const now = Date.now();

    keys.forEach(key => {
      if (key.startsWith(this.prefix)) {
        try {
          const item = localStorage.getItem(key);
          if (item) {
            const parsed = JSON.parse(item);
            if (now - parsed.timestamp > parsed.ttl) {
              localStorage.removeItem(key);
            }
          }
        } catch (error) {
          // 破損したデータを削除
          localStorage.removeItem(key);
        }
      }
    });
  }
}

// API レスポンスキャッシュ
export class APICache {
  private static cache = BrowserCache.getInstance();

  static async fetchWithCache<T>(
    url: string,
    options: RequestInit = {},
    ttlMinutes: number = 15
  ): Promise<T> {
    const cacheKey = `api_${url}_${JSON.stringify(options)}`;
    
    // キャッシュから取得を試行
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // APIを呼び出し
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // キャッシュに保存
      this.cache.set(cacheKey, data, ttlMinutes);
      
      return data;
    } catch (error) {
      console.error('API fetch error:', error);
      throw error;
    }
  }

  static clearAPICache(): void {
    // API関連のキャッシュのみクリア
    const cache = this.cache as any;
    for (const [key] of cache.cache.entries()) {
      if (key.startsWith('api_')) {
        cache.cache.delete(key);
      }
    }
  }
}

// 画像キャッシュ
export class ImageCache {
  private static preloadedImages = new Set<string>();

  static preload(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.preloadedImages.has(src)) {
        resolve();
        return;
      }

      const img = new Image();
      img.onload = () => {
        this.preloadedImages.add(src);
        resolve();
      };
      img.onerror = reject;
      img.src = src;
    });
  }

  static preloadMultiple(sources: string[]): Promise<void[]> {
    return Promise.all(sources.map(src => this.preload(src)));
  }

  static isPreloaded(src: string): boolean {
    return this.preloadedImages.has(src);
  }
}

// キャッシュ管理のフック
export function useCacheManager() {
  const clearAllCaches = () => {
    BrowserCache.getInstance().clear();
    PersistentCache.clear();
    APICache.clearAPICache();
  };

  const cleanupExpiredCaches = () => {
    BrowserCache.getInstance().cleanup();
    PersistentCache.cleanup();
  };

  return {
    clearAllCaches,
    cleanupExpiredCaches,
  };
}

// 初期化時にクリーンアップを実行
if (typeof window !== 'undefined') {
  // ページロード時に期限切れキャッシュをクリーンアップ
  window.addEventListener('load', () => {
    PersistentCache.cleanup();
    BrowserCache.getInstance().cleanup();
  });

  // 定期的なクリーンアップ（30分ごと）
  setInterval(() => {
    PersistentCache.cleanup();
    BrowserCache.getInstance().cleanup();
  }, 30 * 60 * 1000);
}