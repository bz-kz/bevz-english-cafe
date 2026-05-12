/**
 * Performance Monitoring Utilities
 * パフォーマンス監視のユーティリティ
 */

// Core Web Vitals の測定
export interface WebVitalsMetric {
  name: 'CLS' | 'FID' | 'FCP' | 'LCP' | 'TTFB';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
}

// パフォーマンス測定
export class PerformanceMonitor {
  private static metrics: Map<string, number> = new Map();
  private static observers: PerformanceObserver[] = [];

  // Core Web Vitals の閾値
  private static thresholds = {
    CLS: { good: 0.1, poor: 0.25 },
    FID: { good: 100, poor: 300 },
    FCP: { good: 1800, poor: 3000 },
    LCP: { good: 2500, poor: 4000 },
    TTFB: { good: 800, poor: 1800 },
  };

  static init(): void {
    if (typeof window === 'undefined') return;

    // Largest Contentful Paint (LCP)
    this.observeLCP();

    // First Input Delay (FID)
    this.observeFID();

    // Cumulative Layout Shift (CLS)
    this.observeCLS();

    // First Contentful Paint (FCP)
    this.observeFCP();

    // Time to First Byte (TTFB)
    this.observeTTFB();
  }

  private static observeLCP(): void {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as any;

        if (lastEntry) {
          this.recordMetric('LCP', lastEntry.startTime);
        }
      });

      observer.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.push(observer);
    }
  }

  private static observeFID(): void {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (entry.processingStart && entry.startTime) {
            const fid = entry.processingStart - entry.startTime;
            this.recordMetric('FID', fid);
          }
        });
      });

      observer.observe({ entryTypes: ['first-input'] });
      this.observers.push(observer);
    }
  }

  private static observeCLS(): void {
    if ('PerformanceObserver' in window) {
      let clsValue = 0;

      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        });

        this.recordMetric('CLS', clsValue);
      });

      observer.observe({ entryTypes: ['layout-shift'] });
      this.observers.push(observer);
    }
  }

  private static observeFCP(): void {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (entry.name === 'first-contentful-paint') {
            this.recordMetric('FCP', entry.startTime);
          }
        });
      });

      observer.observe({ entryTypes: ['paint'] });
      this.observers.push(observer);
    }
  }

  private static observeTTFB(): void {
    if ('performance' in window && 'getEntriesByType' in performance) {
      const navigationEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      if (navigationEntries.length > 0) {
        const ttfb = navigationEntries[0].responseStart - navigationEntries[0].requestStart;
        this.recordMetric('TTFB', ttfb);
      }
    }
  }

  private static recordMetric(name: keyof typeof this.thresholds, value: number): void {
    this.metrics.set(name, value);

    const rating = this.getRating(name, value);
    const metric: WebVitalsMetric = {
      name,
      value,
      rating,
      delta: value,
      id: `${name}-${Date.now()}`,
    };

    // Google Analytics に送信
    this.sendToAnalytics(metric);

    // コンソールに出力（開発環境のみ）
    if (process.env.NODE_ENV === 'development') {
      console.log(`${name}: ${value.toFixed(2)} (${rating})`);
    }
  }

  private static getRating(name: keyof typeof this.thresholds, value: number): 'good' | 'needs-improvement' | 'poor' {
    const threshold = this.thresholds[name];
    if (value <= threshold.good) return 'good';
    if (value <= threshold.poor) return 'needs-improvement';
    return 'poor';
  }

  private static sendToAnalytics(metric: WebVitalsMetric): void {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', metric.name, {
        event_category: 'Web Vitals',
        event_label: metric.id,
        value: Math.round(metric.value),
        custom_map: {
          metric_rating: metric.rating,
        },
      });
    }
  }

  static getMetrics(): Map<string, number> {
    return new Map(this.metrics);
  }

  static cleanup(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.metrics.clear();
  }
}

// リソース読み込み時間の測定
export class ResourceMonitor {
  static measureResourceTiming(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('load', () => {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];

      const slowResources = resources.filter(resource =>
        resource.duration > 1000 // 1秒以上かかったリソース
      );

      if (slowResources.length > 0 && process.env.NODE_ENV === 'development') {
        console.warn('Slow loading resources:', slowResources);
      }

      // 画像の読み込み時間を測定
      const images = resources.filter(resource =>
        resource.initiatorType === 'img'
      );

      const avgImageLoadTime = images.reduce((sum, img) => sum + img.duration, 0) / images.length;

      if (window.gtag) {
        window.gtag('event', 'resource_timing', {
          event_category: 'Performance',
          event_label: 'Average Image Load Time',
          value: Math.round(avgImageLoadTime),
        });
      }
    });
  }
}

// メモリ使用量の監視
export class MemoryMonitor {
  static monitor(): void {
    if (typeof window === 'undefined' || !('memory' in performance)) return;

    const memory = (performance as any).memory;

    const memoryInfo = {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
    };

    // メモリ使用率が80%を超えた場合に警告
    const usageRatio = memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit;
    if (usageRatio > 0.8) {
      console.warn('High memory usage detected:', memoryInfo);

      if (window.gtag) {
        window.gtag('event', 'high_memory_usage', {
          event_category: 'Performance',
          event_label: 'Memory Usage',
          value: Math.round(usageRatio * 100),
        });
      }
    }
  }

  static startMonitoring(intervalMs: number = 30000): void {
    setInterval(() => {
      this.monitor();
    }, intervalMs);
  }
}

// パフォーマンス最適化の提案
export class PerformanceOptimizer {
  static analyzeAndSuggest(): void {
    if (typeof window === 'undefined') return;

    const metrics = PerformanceMonitor.getMetrics();
    const suggestions: string[] = [];

    // LCP が遅い場合
    const lcp = metrics.get('LCP');
    if (lcp && lcp > 2500) {
      suggestions.push('LCP improvement: Consider optimizing images and reducing server response time');
    }

    // FID が遅い場合
    const fid = metrics.get('FID');
    if (fid && fid > 100) {
      suggestions.push('FID improvement: Consider reducing JavaScript execution time');
    }

    // CLS が高い場合
    const cls = metrics.get('CLS');
    if (cls && cls > 0.1) {
      suggestions.push('CLS improvement: Ensure images and ads have dimensions specified');
    }

    if (suggestions.length > 0 && process.env.NODE_ENV === 'development') {
      console.group('Performance Optimization Suggestions:');
      suggestions.forEach(suggestion => console.log(`• ${suggestion}`));
      console.groupEnd();
    }
  }
}

// 初期化
if (typeof window !== 'undefined') {
  // ページロード後にパフォーマンス監視を開始
  window.addEventListener('load', () => {
    PerformanceMonitor.init();
    ResourceMonitor.measureResourceTiming();
    MemoryMonitor.startMonitoring();

    // 5秒後に分析と提案を実行
    setTimeout(() => {
      PerformanceOptimizer.analyzeAndSuggest();
    }, 5000);
  });

  // ページ離脱時にクリーンアップ
  window.addEventListener('beforeunload', () => {
    PerformanceMonitor.cleanup();
  });
}