/**
 * Cache Utilities Tests
 * `src/utils/cache.ts` の BrowserCache / PersistentCache / ImageCache /
 * useCacheManager の挙動を検証する。
 *
 * 注意: 旧テストは存在しない API (`CacheManager`, `getCachedData` 等) を想定して
 * いたため全面的に書き直している。プロダクションコードで実際に export されて
 * いるシンボルだけを対象にする。
 */

import {
  BrowserCache,
  PersistentCache,
  APICache,
  ImageCache,
  useCacheManager,
} from '../cache';

describe('Cache Utilities', () => {
  describe('BrowserCache', () => {
    let cache: BrowserCache;

    beforeEach(() => {
      cache = BrowserCache.getInstance();
      cache.clear(); // シングルトンなのでテスト間で状態をリセット
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-01T00:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('シングルトンとして同一インスタンスを返す', () => {
      const a = BrowserCache.getInstance();
      const b = BrowserCache.getInstance();
      expect(a).toBe(b);
    });

    it('値を保存して取り出せる', () => {
      cache.set('user', { id: 1 });
      expect(cache.get('user')).toEqual({ id: 1 });
    });

    it('存在しないキーは null を返す', () => {
      expect(cache.get('missing')).toBeNull();
    });

    it('TTL を過ぎたら null を返しキャッシュから削除する', () => {
      cache.set('temp', 'value', 1); // 1 分 TTL

      // 30 秒経過 → まだ生きている
      jest.advanceTimersByTime(30 * 1000);
      expect(cache.get('temp')).toBe('value');

      // さらに 31 秒経過 → 失効
      jest.advanceTimersByTime(31 * 1000);
      expect(cache.get('temp')).toBeNull();
    });

    it('特定キーのみクリアできる', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.clear('a');
      expect(cache.get('a')).toBeNull();
      expect(cache.get('b')).toBe(2);
    });

    it('引数なし clear で全消去できる', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.clear();
      expect(cache.get('a')).toBeNull();
      expect(cache.get('b')).toBeNull();
    });

    it('cleanup() で期限切れエントリだけ削除する', () => {
      cache.set('alive', 'ok', 10); // 10 分 TTL
      cache.set('dead', 'old', 1); // 1 分 TTL

      jest.advanceTimersByTime(2 * 60 * 1000); // 2 分後
      cache.cleanup();

      expect(cache.get('alive')).toBe('ok');
      expect(cache.get('dead')).toBeNull();
    });
  });

  describe('PersistentCache', () => {
    const PREFIX = 'english_cafe_';

    beforeEach(() => {
      localStorage.clear();
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-01T00:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('値を localStorage に保存し prefix 付きで読み出せる', () => {
      PersistentCache.set('profile', { name: 'Alice' });

      const raw = localStorage.getItem(`${PREFIX}profile`);
      expect(raw).not.toBeNull();
      expect(JSON.parse(raw as string).data).toEqual({ name: 'Alice' });

      expect(PersistentCache.get('profile')).toEqual({ name: 'Alice' });
    });

    it('TTL を過ぎたら null を返してエントリを削除する', () => {
      PersistentCache.set('temp', 'val', 1); // 1 分

      jest.advanceTimersByTime(2 * 60 * 1000);

      expect(PersistentCache.get('temp')).toBeNull();
      expect(localStorage.getItem(`${PREFIX}temp`)).toBeNull();
    });

    it('存在しないキーは null', () => {
      expect(PersistentCache.get('nope')).toBeNull();
    });

    it('壊れた JSON は null を返し例外を投げない', () => {
      localStorage.setItem(`${PREFIX}broken`, 'not-json');
      expect(() => PersistentCache.get('broken')).not.toThrow();
      expect(PersistentCache.get('broken')).toBeNull();
    });

    it('特定キーのみクリアできる', () => {
      PersistentCache.set('a', 1);
      PersistentCache.set('b', 2);
      PersistentCache.clear('a');
      expect(PersistentCache.get('a')).toBeNull();
      expect(PersistentCache.get('b')).toBe(2);
    });

    it('引数なし clear は prefix 付きキーだけ削除し他は残す', () => {
      PersistentCache.set('a', 1);
      PersistentCache.set('b', 2);
      localStorage.setItem('other_key', 'untouched');

      PersistentCache.clear();

      expect(PersistentCache.get('a')).toBeNull();
      expect(PersistentCache.get('b')).toBeNull();
      expect(localStorage.getItem('other_key')).toBe('untouched');
    });

    it('cleanup() は期限切れエントリだけ削除する', () => {
      PersistentCache.set('alive', 'ok', 10);
      PersistentCache.set('dead', 'old', 1);

      jest.advanceTimersByTime(2 * 60 * 1000);
      PersistentCache.cleanup();

      expect(PersistentCache.get('alive')).toBe('ok');
      expect(PersistentCache.get('dead')).toBeNull();
    });
  });

  describe('ImageCache', () => {
    // jsdom 環境では HTMLImageElement.onload は手動でトリガーする必要がある
    beforeEach(() => {
      // 既プリロード集合をリセットするため reload するわけにいかないので
      // 各テストで一意な src を使う
    });

    it('preload は最初の呼び出しで Promise を返し、画像 onload で resolve する', async () => {
      const src = `https://example.com/${Math.random()}.png`;

      // Image の onload を即時発火させる
      const originalImage = global.Image;
      class FakeImage {
        public onload: (() => void) | null = null;
        public onerror: (() => void) | null = null;
        set src(_v: string) {
          // マイクロタスクで onload を呼ぶ
          setTimeout(() => this.onload?.(), 0);
        }
      }
      // @ts-expect-error jsdom override
      global.Image = FakeImage;

      await expect(ImageCache.preload(src)).resolves.toBeUndefined();
      expect(ImageCache.isPreloaded(src)).toBe(true);

      global.Image = originalImage;
    });

    it('preloadMultiple は配列分の Promise を解決する', async () => {
      const originalImage = global.Image;
      class FakeImage {
        public onload: (() => void) | null = null;
        public onerror: (() => void) | null = null;
        set src(_v: string) {
          setTimeout(() => this.onload?.(), 0);
        }
      }
      // @ts-expect-error jsdom override
      global.Image = FakeImage;

      const sources = [
        `https://example.com/multi-${Math.random()}-a.png`,
        `https://example.com/multi-${Math.random()}-b.png`,
      ];
      const results = await ImageCache.preloadMultiple(sources);

      expect(results).toHaveLength(2);
      sources.forEach(s => expect(ImageCache.isPreloaded(s)).toBe(true));

      global.Image = originalImage;
    });
  });

  describe('useCacheManager', () => {
    it('clearAllCaches と cleanupExpiredCaches を提供する', () => {
      const { clearAllCaches, cleanupExpiredCaches } = useCacheManager();
      expect(typeof clearAllCaches).toBe('function');
      expect(typeof cleanupExpiredCaches).toBe('function');

      // 例外なく実行できる
      expect(() => clearAllCaches()).not.toThrow();
      expect(() => cleanupExpiredCaches()).not.toThrow();
    });
  });

  describe('APICache', () => {
    let originalFetch: typeof global.fetch | undefined;

    beforeEach(() => {
      originalFetch = global.fetch;
      // jsdom には fetch が無いので spy 用にダミー実装を仕込む
      global.fetch = jest.fn() as unknown as typeof global.fetch;
    });

    afterEach(() => {
      jest.restoreAllMocks();
      if (originalFetch) {
        global.fetch = originalFetch;
      } else {
        // @ts-expect-error: jsdom restore
        delete global.fetch;
      }
    });

    it('fetchWithCache は初回 fetch し 2 回目はキャッシュから返す', async () => {
      const mockResponse = { id: 1, value: 'cached' };
      const fetchMock = global.fetch as jest.Mock;
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const url = `/api/test-${Math.random()}`;
      const first = await APICache.fetchWithCache(url);
      const second = await APICache.fetchWithCache(url);

      expect(first).toEqual(mockResponse);
      expect(second).toEqual(mockResponse);
      expect(fetchMock).toHaveBeenCalledTimes(1); // 2 回目はキャッシュヒット
    });

    it('レスポンスが ok でない場合は例外をスローする', async () => {
      const fetchMock = global.fetch as jest.Mock;
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(
        APICache.fetchWithCache(`/api/error-${Math.random()}`)
      ).rejects.toThrow();
    });
  });
});
