/**
 * Jest環境変数設定
 * 統合テスト用の環境変数を設定
 */

// テスト用環境変数
process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:8000';
process.env.NODE_ENV = 'test';

// テスト用のモック値
process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = 'test-google-maps-key';
process.env.NEXT_PUBLIC_YOUTUBE_API_KEY = 'test-youtube-key';

// デバッグ用
console.log('Jest環境変数設定完了:', {
  API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NODE_ENV: process.env.NODE_ENV
});