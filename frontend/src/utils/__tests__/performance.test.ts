/**
 * Performance Utilities Tests
 * `src/utils/performance.ts` の PerformanceMonitor / ResourceMonitor /
 * MemoryMonitor / PerformanceOptimizer の挙動を検証する。
 *
 * 注意: 旧テストは存在しない API (`measurePerformance`, `reportWebVitals` 等)
 * を想定していたため全面的に書き直している。
 */

import {
  PerformanceMonitor,
  ResourceMonitor,
  MemoryMonitor,
  PerformanceOptimizer,
  type WebVitalsMetric,
} from '../performance';

describe('Performance Utilities', () => {
  beforeEach(() => {
    PerformanceMonitor.cleanup();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    PerformanceMonitor.cleanup();
  });

  describe('WebVitalsMetric 型', () => {
    it('rating は good / needs-improvement / poor のいずれか', () => {
      const metric: WebVitalsMetric = {
        name: 'LCP',
        value: 2000,
        rating: 'good',
        delta: 2000,
        id: 'lcp-1',
      };
      expect(['good', 'needs-improvement', 'poor']).toContain(metric.rating);
    });
  });

  describe('PerformanceMonitor', () => {
    it('init() は jsdom (PerformanceObserver なし) でも例外を投げない', () => {
      expect(() => PerformanceMonitor.init()).not.toThrow();
    });

    it('getMetrics() は Map を返す（初期は空）', () => {
      const metrics = PerformanceMonitor.getMetrics();
      expect(metrics).toBeInstanceOf(Map);
    });

    it('cleanup() を複数回呼んでも例外を投げない', () => {
      PerformanceMonitor.init();
      PerformanceMonitor.cleanup();
      expect(() => PerformanceMonitor.cleanup()).not.toThrow();
    });
  });

  describe('ResourceMonitor', () => {
    it('measureResourceTiming() は load イベントリスナーを登録する', () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
      ResourceMonitor.measureResourceTiming();
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'load',
        expect.any(Function)
      );
    });
  });

  describe('MemoryMonitor', () => {
    it('memory API が無い環境では monitor() が静かに return する', () => {
      // jsdom には performance.memory が無いので何もせず終わる
      expect(() => MemoryMonitor.monitor()).not.toThrow();
    });

    it('startMonitoring() は setInterval を呼び出す', () => {
      jest.useFakeTimers();
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      MemoryMonitor.startMonitoring(1000);
      expect(setIntervalSpy).toHaveBeenCalled();
      jest.useRealTimers();
    });
  });

  describe('PerformanceOptimizer', () => {
    it('analyzeAndSuggest() は例外を投げない', () => {
      expect(() => PerformanceOptimizer.analyzeAndSuggest()).not.toThrow();
    });
  });
});
