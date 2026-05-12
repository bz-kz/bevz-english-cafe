/**
 * Application Monitoring Utilities
 * アプリケーション監視のユーティリティ
 */

// New Relic Browser Agent の設定
export class NewRelicMonitoring {
  private static isInitialized = false;

  static init(): void {
    if (typeof window === 'undefined' || this.isInitialized) return;

    const licenseKey = process.env.NEXT_PUBLIC_NEW_RELIC_LICENSE_KEY;
    const applicationId = process.env.NEXT_PUBLIC_NEW_RELIC_APP_ID;

    if (!licenseKey || !applicationId) {
      console.warn('New Relic configuration missing');
      return;
    }

    // New Relic Browser Agent の動的読み込み
    const script = document.createElement('script');
    script.src = 'https://js-agent.newrelic.com/nr-loader-spa-current.min.js';
    script.onload = () => {
      if (window.NREUM) {
        window.NREUM.loader_config = {
          accountID: applicationId,
          trustKey: applicationId,
          agentID: applicationId,
          licenseKey: licenseKey,
          applicationID: applicationId
        };
        window.NREUM.init = {
          distributed_tracing: { enabled: true },
          privacy: { cookies_enabled: true },
          ajax: { deny_list: ['bam.nr-data.net'] }
        };
      }
    };
    document.head.appendChild(script);

    this.isInitialized = true;
  }

  // カスタムイベントの送信
  static addPageAction(name: string, attributes?: Record<string, any>): void {
    if (typeof window !== 'undefined' && window.newrelic) {
      window.newrelic.addPageAction(name, attributes);
    }
  }

  // エラーの記録
  static noticeError(error: Error, attributes?: Record<string, any>): void {
    if (typeof window !== 'undefined' && window.newrelic) {
      window.newrelic.noticeError(error, attributes);
    }
  }

  // カスタム属性の設定
  static setCustomAttribute(name: string, value: string | number): void {
    if (typeof window !== 'undefined' && window.newrelic) {
      window.newrelic.setCustomAttribute(name, value);
    }
  }
}

// Grafana Cloud への メトリクス送信
export class GrafanaMetrics {
  private static endpoint = process.env.NEXT_PUBLIC_GRAFANA_ENDPOINT;
  private static apiKey = process.env.NEXT_PUBLIC_GRAFANA_API_KEY;

  static async sendMetric(
    metricName: string,
    value: number,
    labels: Record<string, string> = {}
  ): Promise<void> {
    if (!this.endpoint || !this.apiKey) {
      console.warn('Grafana configuration missing');
      return;
    }

    const metric = {
      name: metricName,
      value: value,
      timestamp: Date.now(),
      labels: {
        app: 'english-cafe',
        environment: process.env.NODE_ENV || 'development',
        ...labels
      }
    };

    try {
      await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([metric])
      });
    } catch (error) {
      console.error('Failed to send metric to Grafana:', error);
    }
  }

  // Web Vitals メトリクスの送信
  static async sendWebVital(
    name: string,
    value: number,
    rating: string
  ): Promise<void> {
    await this.sendMetric(`web_vitals_${name.toLowerCase()}`, value, {
      metric_type: 'web_vital',
      rating: rating
    });
  }

  // ユーザーアクションの記録
  static async recordUserAction(
    action: string,
    page: string,
    additionalData?: Record<string, string>
  ): Promise<void> {
    await this.sendMetric('user_actions_total', 1, {
      action: action,
      page: page,
      ...additionalData
    });
  }

  // エラー率の記録
  static async recordError(
    errorType: string,
    page: string,
    message?: string
  ): Promise<void> {
    await this.sendMetric('errors_total', 1, {
      error_type: errorType,
      page: page,
      message: message || 'unknown'
    });
  }
}

// 統合監視クラス
export class ApplicationMonitoring {
  private static initialized = false;

  static init(): void {
    if (this.initialized) return;

    // New Relic の初期化
    NewRelicMonitoring.init();

    // エラーハンドリングの設定
    this.setupErrorHandling();

    // パフォーマンス監視の設定
    this.setupPerformanceMonitoring();

    // ユーザーアクション追跡の設定
    this.setupUserActionTracking();

    this.initialized = true;
  }

  private static setupErrorHandling(): void {
    if (typeof window === 'undefined') return;

    // グローバルエラーハンドラー
    window.addEventListener('error', (event) => {
      const error = event.error || new Error(event.message);
      
      NewRelicMonitoring.noticeError(error, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });

      GrafanaMetrics.recordError('javascript_error', window.location.pathname, error.message);
    });

    // Promise rejection ハンドラー
    window.addEventListener('unhandledrejection', (event) => {
      const error = new Error(event.reason);
      
      NewRelicMonitoring.noticeError(error, {
        type: 'unhandled_promise_rejection'
      });

      GrafanaMetrics.recordError('promise_rejection', window.location.pathname, event.reason);
    });
  }

  private static setupPerformanceMonitoring(): void {
    if (typeof window === 'undefined') return;

    // Web Vitals の監視
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      getCLS((metric) => {
        const rating = metric.value <= 0.1 ? 'good' : metric.value <= 0.25 ? 'needs-improvement' : 'poor';
        GrafanaMetrics.sendWebVital('CLS', metric.value, rating);
      });

      getFID((metric) => {
        const rating = metric.value <= 100 ? 'good' : metric.value <= 300 ? 'needs-improvement' : 'poor';
        GrafanaMetrics.sendWebVital('FID', metric.value, rating);
      });

      getFCP((metric) => {
        const rating = metric.value <= 1800 ? 'good' : metric.value <= 3000 ? 'needs-improvement' : 'poor';
        GrafanaMetrics.sendWebVital('FCP', metric.value, rating);
      });

      getLCP((metric) => {
        const rating = metric.value <= 2500 ? 'good' : metric.value <= 4000 ? 'needs-improvement' : 'poor';
        GrafanaMetrics.sendWebVital('LCP', metric.value, rating);
      });

      getTTFB((metric) => {
        const rating = metric.value <= 800 ? 'good' : metric.value <= 1800 ? 'needs-improvement' : 'poor';
        GrafanaMetrics.sendWebVital('TTFB', metric.value, rating);
      });
    }).catch(console.error);

    // ページロード時間の監視
    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigation) {
        const loadTime = navigation.loadEventEnd - navigation.fetchStart;
        GrafanaMetrics.sendMetric('page_load_time', loadTime, {
          page: window.location.pathname
        });
      }
    });
  }

  private static setupUserActionTracking(): void {
    if (typeof window === 'undefined') return;

    // フォーム送信の追跡
    document.addEventListener('submit', (event) => {
      const form = event.target as HTMLFormElement;
      const formName = form.name || form.id || 'unknown';
      
      NewRelicMonitoring.addPageAction('form_submit', {
        form_name: formName,
        page: window.location.pathname
      });

      GrafanaMetrics.recordUserAction('form_submit', window.location.pathname, {
        form_name: formName
      });
    });

    // ボタンクリックの追跡
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'BUTTON' || target.closest('button')) {
        const button = target.tagName === 'BUTTON' ? target : target.closest('button');
        const buttonText = button?.textContent?.trim() || 'unknown';
        
        NewRelicMonitoring.addPageAction('button_click', {
          button_text: buttonText,
          page: window.location.pathname
        });

        GrafanaMetrics.recordUserAction('button_click', window.location.pathname, {
          button_text: buttonText
        });
      }
    });

    // ページビューの追跡
    const trackPageView = () => {
      NewRelicMonitoring.addPageAction('page_view', {
        page: window.location.pathname,
        referrer: document.referrer
      });

      GrafanaMetrics.recordUserAction('page_view', window.location.pathname, {
        referrer: document.referrer || 'direct'
      });
    };

    // 初回ページビュー
    trackPageView();

    // SPA ナビゲーションの追跡
    let currentPath = window.location.pathname;
    const observer = new MutationObserver(() => {
      if (window.location.pathname !== currentPath) {
        currentPath = window.location.pathname;
        trackPageView();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // ビジネスメトリクスの記録
  static recordBusinessMetric(
    metricName: string,
    value: number,
    attributes?: Record<string, string>
  ): void {
    NewRelicMonitoring.addPageAction(metricName, {
      value: value,
      ...attributes
    });

    GrafanaMetrics.sendMetric(metricName, value, attributes);
  }

  // レッスン予約の追跡
  static recordLessonInquiry(lessonType: string, instructorName?: string): void {
    this.recordBusinessMetric('lesson_inquiry', 1, {
      lesson_type: lessonType,
      instructor: instructorName || 'any'
    });
  }

  // 問い合わせフォーム送信の追跡
  static recordContactSubmission(contactType: string): void {
    this.recordBusinessMetric('contact_submission', 1, {
      contact_type: contactType
    });
  }

  // 動画再生の追跡
  static recordVideoPlay(videoId: string, videoTitle: string): void {
    this.recordBusinessMetric('video_play', 1, {
      video_id: videoId,
      video_title: videoTitle
    });
  }
}

// TypeScript 型定義
declare global {
  interface Window {
    newrelic?: {
      addPageAction: (name: string, attributes?: Record<string, any>) => void;
      noticeError: (error: Error, attributes?: Record<string, any>) => void;
      setCustomAttribute: (name: string, value: string | number) => void;
    };
    NREUM?: any;
  }
}