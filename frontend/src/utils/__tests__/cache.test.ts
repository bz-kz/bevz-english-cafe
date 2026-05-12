/**
 * Cache Utilities Tests
 * キャッシュユーティリティのユニットテスト
 */

import { 
  CacheManager, 
  createCacheKey, 
  getCachedData, 
  setCachedData, 
  clearCache,
  CacheOptions 
} from '../cache';

// localStorage のモック
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

describe('Cache Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(1000000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createCacheKey', () => {
    it('creates cache key from string', () => {
      const key = createCacheKey('test-key');
      expect(key).toBe('cache:test-key');
    });

    it('creates cache key from array', () => {
      const key = createCacheKey(['user', '123', 'profile']);
      expect(key).toBe('cache:user:123:profile');
    });

    it('creates cache key from object', () => {
      const key = createCacheKey({ type: 'user', id: 123, action: 'get' });
      expect(key).toBe('cache:type=user:id=123:action=get');
    });

    it('handles empty inputs', () => {
      expect(createCacheKey('')).toBe('cache:');
      expect(createCacheKey([])).toBe('cache:');
      expect(createCacheKey({})).toBe('cache:');
    });

    it('handles special characters in keys', () => {
      const key = createCacheKey('test/key:with-special_chars');
      expect(key).toBe('cache:test/key:with-special_chars');
    });
  });

  describe('getCachedData', () => {
    it('retrieves valid cached data', () => {
      const cachedItem = {
        data: { name: 'John', age: 30 },
        timestamp: 1000000,
        ttl: 60000, // 1 minute
      };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(cachedItem));

      const result = getCachedData('test-key');

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('cache:test-key');
      expect(result).toEqual({ name: 'John', age: 30 });
    });

    it('returns null for expired data', () => {
      const expiredItem = {
        data: { name: 'John', age: 30 },
        timestamp: 900000, // 100 seconds ago
        ttl: 60000, // 1 minute TTL
      };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(expiredItem));

      const result = getCachedData('test-key');

      expect(result).toBeNull();
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('cache:test-key');
    });

    it('returns null for non-existent data', () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      const result = getCachedData('non-existent-key');

      expect(result).toBeNull();
    });

    it('handles invalid JSON gracefully', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid-json');

      const result = getCachedData('invalid-key');

      expect(result).toBeNull();
    });

    it('handles data without TTL (permanent cache)', () => {
      const permanentItem = {
        data: { permanent: true },
        timestamp: 500000,
        // no ttl property
      };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(permanentItem));

      const result = getCachedData('permanent-key');

      expect(result).toEqual({ permanent: true });
    });
  });

  describe('setCachedData', () => {
    it('stores data with default TTL', () => {
      const data = { name: 'Jane', age: 25 };
      
      setCachedData('test-key', data);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'cache:test-key',
        JSON.stringify({
          data,
          timestamp: 1000000,
          ttl: 300000, // default 5 minutes
        })
      );
    });

    it('stores data with custom TTL', () => {
      const data = { name: 'Bob', age: 35 };
      const options: CacheOptions = { ttl: 120000 }; // 2 minutes
      
      setCachedData('custom-ttl-key', data, options);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'cache:custom-ttl-key',
        JSON.stringify({
          data,
          timestamp: 1000000,
          ttl: 120000,
        })
      );
    });

    it('stores data without TTL (permanent)', () => {
      const data = { permanent: true };
      const options: CacheOptions = { ttl: null };
      
      setCachedData('permanent-key', data, options);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'cache:permanent-key',
        JSON.stringify({
          data,
          timestamp: 1000000,
        })
      );
    });

    it('handles localStorage errors gracefully', () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      expect(() => setCachedData('error-key', { data: 'test' })).not.toThrow();
    });

    it('stores complex data structures', () => {
      const complexData = {
        users: [
          { id: 1, name: 'Alice', preferences: { theme: 'dark' } },
          { id: 2, name: 'Bob', preferences: { theme: 'light' } },
        ],
        metadata: {
          total: 2,
          lastUpdated: new Date().toISOString(),
        },
      };

      setCachedData('complex-data', complexData);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'cache:complex-data',
        JSON.stringify({
          data: complexData,
          timestamp: 1000000,
          ttl: 300000,
        })
      );
    });
  });

  describe('clearCache', () => {
    it('clears specific cache entry', () => {
      clearCache('specific-key');

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('cache:specific-key');
    });

    it('clears all cache entries when no key provided', () => {
      // localStorage.key() のモック
      Object.defineProperty(mockLocalStorage, 'length', { value: 3 });
      mockLocalStorage.key = jest.fn()
        .mockReturnValueOnce('cache:key1')
        .mockReturnValueOnce('other:key')
        .mockReturnValueOnce('cache:key2');

      clearCache();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('cache:key1');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('cache:key2');
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalledWith('other:key');
    });

    it('handles localStorage errors during clear', () => {
      mockLocalStorage.removeItem.mockImplementation(() => {
        throw new Error('Remove failed');
      });

      expect(() => clearCache('error-key')).not.toThrow();
    });
  });

  describe('CacheManager', () => {
    let cacheManager: CacheManager;

    beforeEach(() => {
      cacheManager = new CacheManager('test-namespace');
    });

    it('creates cache manager with namespace', () => {
      expect(cacheManager).toBeInstanceOf(CacheManager);
    });

    it('gets data with namespace', () => {
      const cachedItem = {
        data: { test: 'data' },
        timestamp: 1000000,
        ttl: 60000,
      };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(cachedItem));

      const result = cacheManager.get('test-key');

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('cache:test-namespace:test-key');
      expect(result).toEqual({ test: 'data' });
    });

    it('sets data with namespace', () => {
      const data = { namespace: 'test' };
      
      cacheManager.set('test-key', data);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'cache:test-namespace:test-key',
        JSON.stringify({
          data,
          timestamp: 1000000,
          ttl: 300000,
        })
      );
    });

    it('clears data with namespace', () => {
      cacheManager.clear('test-key');

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('cache:test-namespace:test-key');
    });

    it('clears all data in namespace', () => {
      Object.defineProperty(mockLocalStorage, 'length', { value: 4 });
      mockLocalStorage.key = jest.fn()
        .mockReturnValueOnce('cache:test-namespace:key1')
        .mockReturnValueOnce('cache:other-namespace:key1')
        .mockReturnValueOnce('cache:test-namespace:key2')
        .mockReturnValueOnce('other:key');

      cacheManager.clearAll();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('cache:test-namespace:key1');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('cache:test-namespace:key2');
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalledWith('cache:other-namespace:key1');
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalledWith('other:key');
    });

    it('checks if data exists in cache', () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
        data: { exists: true },
        timestamp: 1000000,
        ttl: 60000,
      }));

      const exists = cacheManager.has('existing-key');

      expect(exists).toBe(true);
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('cache:test-namespace:existing-key');
    });

    it('returns false for non-existent data', () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      const exists = cacheManager.has('non-existent-key');

      expect(exists).toBe(false);
    });

    it('returns false for expired data', () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
        data: { expired: true },
        timestamp: 900000,
        ttl: 60000,
      }));

      const exists = cacheManager.has('expired-key');

      expect(exists).toBe(false);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('handles localStorage not available', () => {
      const originalLocalStorage = window.localStorage;
      // @ts-ignore
      delete window.localStorage;

      expect(() => getCachedData('test')).not.toThrow();
      expect(() => setCachedData('test', { data: 'test' })).not.toThrow();
      expect(() => clearCache('test')).not.toThrow();

      window.localStorage = originalLocalStorage;
    });

    it('handles circular references in data', () => {
      const circularData: any = { name: 'test' };
      circularData.self = circularData;

      // JSON.stringify should handle this gracefully or throw
      expect(() => setCachedData('circular', circularData)).not.toThrow();
    });

    it('handles very large data', () => {
      const largeData = {
        items: Array(10000).fill(0).map((_, i) => ({
          id: i,
          data: `item-${i}`.repeat(100),
        })),
      };

      expect(() => setCachedData('large-data', largeData)).not.toThrow();
    });
  });
});