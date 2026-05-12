/**
 * Monitoring Dashboard Component
 * 監視ダッシュボードコンポーネント（管理者用）
 */

'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui';

interface MetricData {
  name: string;
  value: number;
  unit: string;
  status: 'good' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'stable';
}

interface ErrorData {
  timestamp: string;
  message: string;
  page: string;
  count: number;
}

export function MonitoringDashboard() {
  const [metrics, setMetrics] = useState<MetricData[]>([]);
  const [errors, setErrors] = useState<ErrorData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 実際の実装では API からデータを取得
    const mockMetrics: MetricData[] = [
      {
        name: 'LCP (Largest Contentful Paint)',
        value: 1.8,
        unit: 's',
        status: 'good',
        trend: 'stable'
      },
      {
        name: 'FID (First Input Delay)',
        value: 85,
        unit: 'ms',
        status: 'good',
        trend: 'down'
      },
      {
        name: 'CLS (Cumulative Layout Shift)',
        value: 0.08,
        unit: '',
        status: 'good',
        trend: 'stable'
      },
      {
        name: 'TTFB (Time to First Byte)',
        value: 650,
        unit: 'ms',
        status: 'good',
        trend: 'up'
      },
      {
        name: 'Page Load Time',
        value: 2.3,
        unit: 's',
        status: 'good',
        trend: 'stable'
      },
      {
        name: 'Error Rate',
        value: 0.2,
        unit: '%',
        status: 'good',
        trend: 'down'
      }
    ];

    const mockErrors: ErrorData[] = [
      {
        timestamp: '2024-01-13 10:30:00',
        message: 'Failed to load image',
        page: '/instructors',
        count: 3
      },
      {
        timestamp: '2024-01-13 09:15:00',
        message: 'Network request timeout',
        page: '/contact',
        count: 1
      }
    ];

    setTimeout(() => {
      setMetrics(mockMetrics);
      setErrors(mockErrors);
      setIsLoading(false);
    }, 1000);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'text-green-600 bg-green-100';
      case 'warning': return 'text-yellow-600 bg-yellow-100';
      case 'critical': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return (
          <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        );
      case 'down':
        return (
          <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M14.707 12.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-gray-200 rounded-lg h-32"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">
          パフォーマンス監視ダッシュボード
        </h1>
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span>リアルタイム監視中</span>
        </div>
      </div>

      {/* Core Web Vitals */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Core Web Vitals
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {metrics.map((metric, index) => (
            <Card key={index} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-900">
                  {metric.name}
                </h3>
                <div className="flex items-center space-x-1">
                  {getTrendIcon(metric.trend)}
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(metric.status)}`}>
                    {metric.status}
                  </span>
                </div>
              </div>
              <div className="flex items-baseline">
                <span className="text-3xl font-bold text-gray-900">
                  {metric.value}
                </span>
                <span className="ml-1 text-sm text-gray-500">
                  {metric.unit}
                </span>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* エラー監視 */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          最近のエラー
        </h2>
        <Card className="overflow-hidden">
          {errors.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      時刻
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      エラーメッセージ
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ページ
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      発生回数
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {errors.map((error, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {error.timestamp}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {error.message}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {error.page}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          {error.count}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 text-center text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>エラーは発生していません</p>
            </div>
          )}
        </Card>
      </div>

      {/* 外部監視ツールへのリンク */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          外部監視ツール
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 7v10c0 5.55 3.84 9.95 9 11 5.16-1.05 9-5.45 9-11V7l-10-5z"/>
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-gray-900">New Relic</h3>
                <p className="text-sm text-gray-500">APM監視</p>
              </div>
            </div>
            <a
              href="https://one.newrelic.com"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 block w-full text-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              ダッシュボードを開く
            </a>
          </Card>

          <Card className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-orange-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Grafana</h3>
                <p className="text-sm text-gray-500">メトリクス可視化</p>
              </div>
            </div>
            <a
              href="https://grafana.com"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 block w-full text-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              ダッシュボードを開く
            </a>
          </Card>

          <Card className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Google Analytics</h3>
                <p className="text-sm text-gray-500">ユーザー分析</p>
              </div>
            </div>
            <a
              href="https://analytics.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 block w-full text-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              ダッシュボードを開く
            </a>
          </Card>

          <Card className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Vercel Analytics</h3>
                <p className="text-sm text-gray-500">Web Vitals</p>
              </div>
            </div>
            <a
              href="https://vercel.com/analytics"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 block w-full text-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              ダッシュボードを開く
            </a>
          </Card>
        </div>
      </div>
    </div>
  );
}