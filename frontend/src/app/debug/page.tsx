/**
 * Debug Page
 * 開発・デバッグ用のページ
 */

'use client';

import { useState } from 'react';
import { Button, Card } from '@/components/ui';
import { contactApi } from '@/lib/api';

interface ApiResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: any;
  id?: string;
  timestamp?: string;
}

export default function DebugPage() {
  const [healthStatus, setHealthStatus] = useState<string>('');
  const [isChecking, setIsChecking] = useState(false);
  const [apiResponse, setApiResponse] = useState<ApiResponse | null>(null);

  // 本番環境では表示しない
  if (process.env.NODE_ENV === 'production') {
    return (
      <div className="container mx-auto py-20">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">404 - Page Not Found</h1>
          <p className="text-gray-600">このページは存在しません。</p>
        </div>
      </div>
    );
  }

  const handleHealthCheck = async () => {
    setIsChecking(true);
    setHealthStatus('');
    setApiResponse(null);

    try {
      const response = await contactApi.healthCheck();
      setApiResponse(response);

      if (response.success) {
        setHealthStatus('✅ API接続正常');
      } else {
        setHealthStatus(`❌ API接続エラー: ${response.error || '不明なエラー'}`);
      }
    } catch (error: any) {
      setHealthStatus(`❌ ネットワークエラー: ${error.message}`);
      setApiResponse({ success: false, error: error.message });
    } finally {
      setIsChecking(false);
    }
  };

  const testContactSubmission = async () => {
    setIsChecking(true);
    setApiResponse(null);

    try {
      const testData = {
        name: 'テストユーザー',
        email: 'test@example.com',
        phone: '090-1234-5678',
        lessonType: 'trial',
        preferredContact: 'email',
        message: 'これはテスト送信です。'
      };

      const response = await contactApi.submit(testData);
      setApiResponse(response);

      if (response.success) {
        setHealthStatus('✅ 問い合わせ送信テスト成功');
      } else {
        setHealthStatus(`❌ 問い合わせ送信テスト失敗: ${response.error || '不明なエラー'}`);
      }

    } catch (error: any) {
      setHealthStatus(`❌ 問い合わせ送信エラー: ${error.message}`);
      setApiResponse({ success: false, error: error.message });
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="container mx-auto py-12">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Debug Tools</h1>
          <p className="text-lg text-gray-600">
            開発・デバッグ用のツールです。本番環境では表示されません。
          </p>
        </div>

        <div className="grid gap-8">
          {/* API Health Check */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">API接続テスト</h2>

            <div className="space-y-4">
              <div className="flex gap-4">
                <Button
                  onClick={handleHealthCheck}
                  disabled={isChecking}
                >
                  {isChecking ? '確認中...' : 'ヘルスチェック'}
                </Button>

                <Button
                  onClick={testContactSubmission}
                  disabled={isChecking}
                  variant="secondary"
                >
                  {isChecking ? 'テスト中...' : '問い合わせ送信テスト'}
                </Button>
              </div>

              {healthStatus && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="font-medium">{healthStatus}</p>
                </div>
              )}

              {apiResponse && (
                <div className="p-4 bg-gray-100 rounded-lg">
                  <h3 className="font-medium mb-2">APIレスポンス:</h3>
                  <pre className="text-sm overflow-auto">
                    {JSON.stringify(apiResponse, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </Card>

          {/* Environment Variables */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">環境変数</h2>
            <div className="space-y-2 text-sm font-mono">
              <div className="grid grid-cols-2 gap-4">
                <span className="text-gray-600">NODE_ENV:</span>
                <span className="text-gray-900">{process.env.NODE_ENV}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <span className="text-gray-600">NEXT_PUBLIC_API_BASE_URL:</span>
                <span className="text-gray-900">{process.env.NEXT_PUBLIC_API_BASE_URL || 'undefined'}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <span className="text-gray-600">現在のURL:</span>
                <span className="text-gray-900">{typeof window !== 'undefined' ? window.location.origin : 'Server Side'}</span>
              </div>
            </div>
          </Card>

          {/* Network Information */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">ネットワーク情報</h2>
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <span className="text-gray-600">User Agent:</span>
                <span className="text-gray-900 break-all">
                  {typeof navigator !== 'undefined' ? navigator.userAgent : 'Server Side'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <span className="text-gray-600">Online Status:</span>
                <span className="text-gray-900">
                  {typeof navigator !== 'undefined' ? (navigator.onLine ? '✅ オンライン' : '❌ オフライン') : 'Unknown'}
                </span>
              </div>
            </div>
          </Card>

          {/* Troubleshooting Guide */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">トラブルシューティング</h2>
            <div className="space-y-3 text-sm">
              <div>
                <h3 className="font-medium text-gray-800">API接続エラーの場合:</h3>
                <ul className="list-disc list-inside text-gray-600 mt-1 space-y-1">
                  <li>バックエンドサーバーが起動しているか確認</li>
                  <li>環境変数 NEXT_PUBLIC_API_BASE_URL が正しく設定されているか確認</li>
                  <li>CORS設定が正しく設定されているか確認</li>
                  <li>ファイアウォールやプロキシの設定を確認</li>
                </ul>
              </div>

              <div>
                <h3 className="font-medium text-gray-800">ネットワークエラーの場合:</h3>
                <ul className="list-disc list-inside text-gray-600 mt-1 space-y-1">
                  <li>インターネット接続を確認</li>
                  <li>DNSの設定を確認</li>
                  <li>プロキシサーバーの設定を確認</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}