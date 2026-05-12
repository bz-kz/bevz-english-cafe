/**
 * API統合テスト
 * バックエンドAPIとの統合テストを実行
 */

import { contactApi } from '@/lib/api';
import { ContactFormData } from '@/lib/api';

// テスト用のモックサーバーURL
const TEST_API_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

describe('API Integration Tests', () => {
  beforeAll(() => {
    // テスト前にAPIサーバーが起動していることを確認
    console.log(`Testing against API server: ${TEST_API_URL}`);
  });

  describe('Contact API', () => {
    const validContactData = {
      name: 'テスト太郎',
      email: 'test@example.com',
      phone: '090-1234-5678',
      message: 'これは統合テスト用のメッセージです。レッスンについて詳しく教えてください。',
      lessonType: 'trial',
      preferredContact: 'email'
    };

    it('should successfully submit contact form with valid data', async () => {
      const response = await contactApi.submit(validContactData);
      
      expect(response.success).toBe(true);
      expect(response.message).toContain('お問い合わせを受け付けました');
      expect(response.id).toBeDefined();
      expect(response.timestamp).toBeDefined();
    });

    it('should handle validation errors for missing required fields', async () => {
      const invalidData = {
        ...validContactData,
        name: '',
        email: '',
        message: ''
      };

      await expect(contactApi.submit(invalidData)).rejects.toThrow();
    });

    it('should handle validation errors for invalid email format', async () => {
      const invalidEmailData = {
        ...validContactData,
        email: 'invalid-email'
      };

      await expect(contactApi.submit(invalidEmailData)).rejects.toThrow();
    });

    it('should handle validation errors for short message', async () => {
      const shortMessageData = {
        ...validContactData,
        message: '短い'
      };

      await expect(contactApi.submit(shortMessageData)).rejects.toThrow();
    });

    it('should handle network errors gracefully', async () => {
      // 無効なURLでテスト
      const originalUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
      process.env.NEXT_PUBLIC_API_BASE_URL = 'http://invalid-url:9999';

      await expect(contactApi.submit(validContactData)).rejects.toThrow();

      // 元のURLに戻す
      process.env.NEXT_PUBLIC_API_BASE_URL = originalUrl;
    });
  });

  describe('Health Check API', () => {
    it('should return healthy status', async () => {
      const response = await fetch(`${TEST_API_URL}/health`);
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.status).toBe('healthy');
      expect(data.message).toBe('英会話カフェ API is running');
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 errors', async () => {
      const response = await fetch(`${TEST_API_URL}/nonexistent`);

      expect(response.status).toBe(404);
    });

    it('should handle CORS properly', async () => {
      const response = await fetch(`${TEST_API_URL}/health`, {
        method: 'GET',
        headers: {
          'Origin': 'http://localhost:3000'
        }
      });

      expect(response.ok).toBe(true);
      // CORS ヘッダーの確認
      expect(response.headers.get('access-control-allow-origin')).toBeTruthy();
    });
  });
});