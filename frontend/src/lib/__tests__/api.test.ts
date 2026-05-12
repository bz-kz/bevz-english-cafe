/**
 * API Library Tests
 * APIライブラリのユニットテスト
 *
 * `contactApi.submit` と `contactApi.submitContact` の挙動を axios インスタンスを
 * モックして検証する。バックエンド `/api/v1/contacts/` への POST と
 * snake_case ペイロード (`lesson_type` / `preferred_contact`) を期待する。
 */

import { contactApi } from '../api';
import apiClient from '../api';
import { mockApi, USE_MOCK_API } from '../mock-api';

jest.mock('../mock-api', () => ({
  USE_MOCK_API: false,
  mockApi: {
    submitContact: jest.fn(),
  },
}));

describe('API Library', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('contactApi.submit (camelCase 入力)', () => {
    const inputData = {
      name: '山田太郎',
      email: 'yamada@example.com',
      phone: '090-1234-5678',
      message: 'テストメッセージ',
      lessonType: 'group',
      preferredContact: 'email',
    };

    it('snake_case に変換してバックエンドへ POST する', async () => {
      const postSpy = jest.spyOn(apiClient, 'post').mockResolvedValueOnce({
        data: { contact_id: 'abc123', message: 'お問い合わせを受け付けました' },
      } as any);

      const result = await contactApi.submit(inputData);

      expect(postSpy).toHaveBeenCalledWith('/api/v1/contacts/', {
        name: '山田太郎',
        email: 'yamada@example.com',
        phone: '090-1234-5678',
        lesson_type: 'group',
        preferred_contact: 'email',
        message: 'テストメッセージ',
      });
      expect(result.success).toBe(true);
      expect(result.id).toBe('abc123');
      expect(result.message).toBe('お問い合わせを受け付けました');
    });

    it('axios エラー時に success: false と error メッセージを返す', async () => {
      const postSpy = jest.spyOn(apiClient, 'post').mockRejectedValueOnce({
        response: { data: { detail: 'Validation failed' } },
        message: 'Request failed',
      });

      const result = await contactApi.submit(inputData);

      expect(postSpy).toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Validation failed');
    });

    it('ネットワークエラー時に汎用エラーメッセージへフォールバックする', async () => {
      jest.spyOn(apiClient, 'post').mockRejectedValueOnce({
        message: 'Network Error',
      });

      const result = await contactApi.submit(inputData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network Error');
    });

    it('複数の lessonType を扱える', async () => {
      const lessonTypes = ['group', 'private', 'trial', 'other'] as const;
      const postSpy = jest.spyOn(apiClient, 'post').mockResolvedValue({
        data: { contact_id: 'id', message: 'ok' },
      } as any);

      for (const lessonType of lessonTypes) {
        await contactApi.submit({ ...inputData, lessonType });
      }

      expect(postSpy).toHaveBeenCalledTimes(lessonTypes.length);
      // 最後の呼び出しが snake_case の lesson_type を含むことを確認
      const lastCall = postSpy.mock.calls[postSpy.mock.calls.length - 1];
      expect(lastCall?.[1]).toMatchObject({ lesson_type: 'other' });
    });

    it('複数の preferredContact を扱える', async () => {
      const methods = [
        'email',
        'phone',
        'line',
        'facebook',
        'instagram',
      ] as const;
      const postSpy = jest.spyOn(apiClient, 'post').mockResolvedValue({
        data: { contact_id: 'id', message: 'ok' },
      } as any);

      for (const preferredContact of methods) {
        await contactApi.submit({ ...inputData, preferredContact });
      }

      expect(postSpy).toHaveBeenCalledTimes(methods.length);
      const lastCall = postSpy.mock.calls[postSpy.mock.calls.length - 1];
      expect(lastCall?.[1]).toMatchObject({ preferred_contact: 'instagram' });
    });
  });

  describe('contactApi.submitContact (snake_case 入力 / 例外スロー版)', () => {
    const snakePayload = {
      name: '田中花子',
      email: 'tanaka@example.com',
      phone: '080-0000-0000',
      message: '別のテストメッセージ',
      lesson_type: 'trial',
      preferred_contact: 'email',
    };

    it('そのまま snake_case で POST する', async () => {
      const postSpy = jest.spyOn(apiClient, 'post').mockResolvedValueOnce({
        data: { contact_id: 'xyz789', message: 'ok' },
      } as any);

      const result = (await contactApi.submitContact(snakePayload)) as {
        success: boolean;
        id: string;
      };

      expect(postSpy).toHaveBeenCalledWith('/api/v1/contacts/', snakePayload);
      expect(result.success).toBe(true);
      expect(result.id).toBe('xyz789');
    });

    it('エラー時は例外をスローする', async () => {
      jest.spyOn(apiClient, 'post').mockRejectedValueOnce({
        response: { data: { detail: 'Server error' } },
      });

      await expect(contactApi.submitContact(snakePayload)).rejects.toThrow(
        'Server error'
      );
    });
  });

  // mockApi を有効化したケースは USE_MOCK_API が compile-time const のため
  // 個別テストで toggle できない。USE_MOCK_API=false 経路のみカバーする。
  it('mock-api モジュールが import 可能であること（smoke）', () => {
    expect(USE_MOCK_API).toBe(false);
    expect(mockApi).toBeDefined();
  });
});
