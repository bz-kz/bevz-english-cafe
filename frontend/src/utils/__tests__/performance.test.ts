/**
 * Performance Utilities Tests
 * パフォーマンスユーティリティのユニットテスト
 */

import { 
  measurePerformance, 
  reportWebVitals, 
  trackPageView, 
  trackEvent,
  PerformanceMetric 
} from '../performance';

// Web Vitals APIのモック
const mockGetCLS = jest.fn();
const mockGetFCP = jest.fn();
const mockGetFID = jest.fn();
const mockGetLCP = jest.fn();
const mockGetTTFB = jest.fn();

jest.mock('web-vitals', () => ({
  getCLS: (callback: Function) => mockGetCLS(callback),
  getFCP: (callback: Function) => mockGetFCP(callback),
  getFID: (callback: Function) => mockGetFID(callback),
  getLCP: (callback: Function) => mockGetLCP(callback),
  getTTFB: (callback: Function) => mockGetTTFB(callback),
}));

// Performance APIのモック
const mockPerformanceMark = jest.fn();
const mockPerformanceMeasure = jest.fn();
const mockPerformanceGetEntriesByName = jest.fn();

Object.defineProperty(global, 'performance', {
  value: {
    mark: mockPerformanceMark,
    measure: mockPerformanceMeasure,
    getEntriesByName: mockPerformanceGetEntriesByName,
    now: jest.fn(() => 1000),
  },
  writable: true,
});

describe('Performance Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // コンソールログをモック
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('measurePerformance', () => {
    it('measures performance of synchronous function', async () => {
      const mockFunction = jest.fn(() => 'result');
      mockPerformanceGetEntriesByName.mockReturnValue([{ duration: 100 }]);

      const result = await measurePerformance('test-operation', mockFunction);

      expect(mockPerformanceMark).toHaveBeenCalledWith('test-operation-start');
      expect(mockFunction).toHaveBeenCalled();
      expect(mockPerformanceMark).toHaveBeenCalledWith('test-operation-end');
      expect(mockPerformanceMeasure).toHaveBeenCalledWith(
        'test-operation',
        'test-operation-start',
        'test-operation-end'
      );
      expect(result).toBe('result');
    });

    it('measures performance of asynchronous function', async () => {
      const mockAsyncFunction = jest.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'async-result';
      });
      mockPerformanceGetEntriesByName.mockReturnValue([{ duration: 150 }]);

      const result = await measurePerformance('async-operation', mockAsyncFunction);

      expect(mockPerformanceMark).toHaveBeenCalledWith('async-operation-start');
      expect(mockAsyncFunction).toHaveBeenCalled();
      expect(mockPerformanceMark).toHaveBeenCalledWith('async-operation-end');
      expect(result).toBe('async-result');
    });

    it('handles function that throws error', async () => {
      const mockErrorFunction = jest.fn(() => {
        throw new Error('Test error');
      });

      await expect(measurePerformance('error-operation', mockErrorFunction))
        .rejects.toThrow('Test error');

      expect(mockPerformanceMark).toHaveBeenCalledWith('error-operation-start');
      expect(mockPerformanceMark).toHaveBeenCalledWith('error-operation-end');
    });

    it('handles Performance API not available', async () => {
      const originalPerformance = global.performance;
      // @ts-ignore
      delete global.performance;

      const mockFunction = jest.fn(() => 'result');
      const result = await measurePerformance('no-perf-api', mockFunction);

      expect(mockFunction).toHaveBeenCalled();
      expect(result).toBe('result');

      global.performance = originalPerformance;
    });
  });

  describe('reportWebVitals', () => {
    it('reports all web vitals metrics', () => {
      const mockCallback = jest.fn();

      reportWebVitals(mockCallback);

      expect(mockGetCLS).toHaveBeenCalledWith(expect.any(Function));
      expect(mockGetFCP).toHaveBeenCalledWith(expect.any(Function));
      expect(mockGetFID).toHaveBeenCalledWith(expect.any(Function));
      expect(mockGetLCP).toHaveBeenCalledWith(expect.any(Function));
      expect(mockGetTTFB).toHaveBeenCalledWith(expect.any(Function));
    });

    it('calls callback with metric data', () => {
      const mockCallback = jest.fn();
      const mockMetric: PerformanceMetric = {
        name: 'CLS',
        value: 0.1,
        id: 'test-id',
        delta: 0.1,
      };

      reportWebVitals(mockCallback);

      // CLSコールバックを実行
      const clsCallback = mockGetCLS.mock.calls[0][0];
      clsCallback(mockMetric);

      expect(mockCallback).toHaveBeenCalledWith(mockMetric);
    });

    it('handles missing callback gracefully', () => {
      expect(() => reportWebVitals()).not.toThrow();
    });
  });

  describe('trackPageView', () => {
    it('tracks page view with URL', () => {
      const consoleSpy = jest.spyOn(console, 'log');

      trackPageView('/test-page');

      expect(consoleSpy).toHaveBeenCalledWith('Page view tracked:', '/test-page');
    });

    it('tracks page view with additional data', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      const additionalData = { title: 'Test Page', referrer: 'https://example.com' };

      trackPageView('/test-page', additionalData);

      expect(consoleSpy).toHaveBeenCalledWith('Page view tracked:', '/test-page', additionalData);
    });

    it('handles empty URL', () => {
      const consoleSpy = jest.spyOn(console, 'log');

      trackPageView('');

      expect(consoleSpy).toHaveBeenCalledWith('Page view tracked:', '');
    });
  });

  describe('trackEvent', () => {
    it('tracks event with name and properties', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      const properties = { category: 'user', action: 'click', label: 'button' };

      trackEvent('button_click', properties);

      expect(consoleSpy).toHaveBeenCalledWith('Event tracked:', 'button_click', properties);
    });

    it('tracks event without properties', () => {
      const consoleSpy = jest.spyOn(console, 'log');

      trackEvent('page_load');

      expect(consoleSpy).toHaveBeenCalledWith('Event tracked:', 'page_load', undefined);
    });

    it('handles empty event name', () => {
      const consoleSpy = jest.spyOn(console, 'log');

      trackEvent('');

      expect(consoleSpy).toHaveBeenCalledWith('Event tracked:', '', undefined);
    });

    it('handles complex event properties', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      const complexProperties = {
        user_id: '12345',
        timestamp: Date.now(),
        metadata: {
          source: 'web',
          version: '1.0.0',
        },
        tags: ['important', 'user-action'],
      };

      trackEvent('complex_event', complexProperties);

      expect(consoleSpy).toHaveBeenCalledWith('Event tracked:', 'complex_event', complexProperties);
    });
  });

  describe('Performance Monitoring Integration', () => {
    it('integrates with real performance measurement', async () => {
      // 実際のパフォーマンス測定をシミュレート
      const testFunction = () => {
        // 何らかの処理をシミュレート
        let sum = 0;
        for (let i = 0; i < 1000; i++) {
          sum += i;
        }
        return sum;
      };

      mockPerformanceGetEntriesByName.mockReturnValue([{ duration: 5.5 }]);

      const result = await measurePerformance('calculation', testFunction);

      expect(typeof result).toBe('number');
      expect(mockPerformanceMeasure).toHaveBeenCalledWith(
        'calculation',
        'calculation-start',
        'calculation-end'
      );
    });

    it('handles multiple concurrent measurements', async () => {
      const func1 = jest.fn(() => 'result1');
      const func2 = jest.fn(() => 'result2');

      mockPerformanceGetEntriesByName.mockReturnValue([{ duration: 10 }]);

      const [result1, result2] = await Promise.all([
        measurePerformance('operation1', func1),
        measurePerformance('operation2', func2),
      ]);

      expect(result1).toBe('result1');
      expect(result2).toBe('result2');
      expect(func1).toHaveBeenCalled();
      expect(func2).toHaveBeenCalled();
    });
  });
});