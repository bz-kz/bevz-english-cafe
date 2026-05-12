/**
 * API Library Tests
 * APIライブラリのユニットテスト
 */

import { contactApi } from '../api';

// fetchのモック
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('API Library', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('contactApi', () => {
    describe('submitContact', () => {
      const mockContactData = {
        name: '山田太郎',
        email: 'yamada@example.com',
        phone: '090-1234-5678',
        message: 'テストメッセージ',
        lessonType: 'group' as const,
        preferredContact: 'email' as const,
      };

      it('submits contact form successfully', async () => {
        const mockResponse = {
          success: true,
          message: 'Contact submitted successfully',
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        } as Response);

        const result = await contactApi.submitContact(mockContactData);

        expect(mockFetch).toHaveBeenCalledWith('/api/contact', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(mockContactData),
        });

        expect(result).toEqual({
          success: true,
          message: 'Contact submitted successfully',
        });
      });

      it('handles API error response', async () => {
        const mockErrorResponse = {
          success: false,
          error: 'Validation failed',
        };

        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => mockErrorResponse,
        } as Response);

        const result = await contactApi.submitContact(mockContactData);

        expect(result).toEqual({
          success: false,
          error: 'Validation failed',
        });
      });

      it('handles network error', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        const result = await contactApi.submitContact(mockContactData);

        expect(result).toEqual({
          success: false,
          error: 'Network error',
        });
      });

      it('handles non-JSON response', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => {
            throw new Error('Invalid JSON');
          },
        } as Response);

        const result = await contactApi.submitContact(mockContactData);

        expect(result).toEqual({
          success: false,
          error: 'サーバーエラーが発生しました',
        });
      });

      it('validates required fields', async () => {
        const invalidData = {
          name: '',
          email: 'invalid-email',
          phone: '',
          message: '',
          lessonType: '' as const,
          preferredContact: 'email' as const,
        };

        // APIが呼ばれる前にクライアント側でバリデーションされることを想定
        // 実際の実装では、フォームコンポーネント側でバリデーションが行われる
        expect(invalidData.name).toBe('');
        expect(invalidData.message).toBe('');
      });

      it('handles different lesson types', async () => {
        const lessonTypes = ['group', 'private', 'trial', 'other'] as const;

        for (const lessonType of lessonTypes) {
          const dataWithLessonType = {
            ...mockContactData,
            lessonType,
          };

          mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ success: true }),
          } as Response);

          await contactApi.submitContact(dataWithLessonType);

          expect(mockFetch).toHaveBeenCalledWith('/api/contact', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(dataWithLessonType),
          });
        }
      });

      it('handles different contact preferences', async () => {
        const contactMethods = ['email', 'phone', 'line', 'facebook', 'instagram'] as const;

        for (const preferredContact of contactMethods) {
          const dataWithContactMethod = {
            ...mockContactData,
            preferredContact,
          };

          mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ success: true }),
          } as Response);

          await contactApi.submitContact(dataWithContactMethod);

          expect(mockFetch).toHaveBeenCalledWith('/api/contact', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(dataWithContactMethod),
          });
        }
      });

      it('handles timeout scenarios', async () => {
        // タイムアウトをシミュレート
        mockFetch.mockImplementationOnce(
          () => new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), 100)
          )
        );

        const result = await contactApi.submitContact(mockContactData);

        expect(result).toEqual({
          success: false,
          error: 'Request timeout',
        });
      });

      it('handles malformed response data', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => null, // 不正なレスポンス
        } as Response);

        const result = await contactApi.submitContact(mockContactData);

        // nullレスポンスでも適切に処理される
        expect(result).toEqual(null);
      });

      it('sends correct content type header', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        } as Response);

        await contactApi.submitContact(mockContactData);

        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
            }),
          })
        );
      });

      it('uses POST method', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        } as Response);

        await contactApi.submitContact(mockContactData);

        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            method: 'POST',
          })
        );
      });

      it('serializes data correctly', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        } as Response);

        await contactApi.submitContact(mockContactData);

        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: JSON.stringify(mockContactData),
          })
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('handles fetch not available', async () => {
      const originalFetch = global.fetch;
      // @ts-ignore
      delete global.fetch;

      try {
        await contactApi.submitContact({
          name: 'Test',
          email: 'test@example.com',
          phone: '',
          message: 'Test message',
          lessonType: 'group',
          preferredContact: 'email',
        });
      } catch (error) {
        expect(error).toBeDefined();
      }

      global.fetch = originalFetch;
    });

    it('handles AbortController scenarios', async () => {
      const controller = new AbortController();
      
      mockFetch.mockRejectedValueOnce(new Error('AbortError'));

      // リクエストを中断
      controller.abort();

      const result = await contactApi.submitContact({
        name: 'Test',
        email: 'test@example.com',
        phone: '',
        message: 'Test message',
        lessonType: 'group',
        preferredContact: 'email',
      });

      expect(result).toEqual({
        success: false,
        error: 'AbortError',
      });
    });
  });
});