/**
 * 問い合わせフォーム統合テスト
 * フォーム送信フロー全体の統合テスト
 *
 * 注意: 旧テストは存在しないラベル（"興味のあるレッスン"）や旧 API
 * (`submitContact` を ContactForm が呼ぶ) を前提にしていたため、
 * 実装に合わせてリライトしている。
 * 実際の ContactForm は `contactApi.submit` (camelCase 入力) を呼ぶ。
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContactForm } from '@/components/forms/ContactForm';
import { contactApi } from '@/lib/api';

// APIをモック化
// ContactForm は contactApi.submit() を呼ぶ（snake_case 変換つき）ので
// submitContact ではなく submit をモックする。
jest.mock('@/lib/api', () => ({
  contactApi: {
    submit: jest.fn(),
  },
}));

const mockContactApi = contactApi as jest.Mocked<typeof contactApi>;

describe('Contact Form Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should complete full form submission flow successfully', async () => {
    const user = userEvent.setup();

    mockContactApi.submit.mockResolvedValue({
      success: true,
      message: 'お問い合わせを受け付けました。2営業日以内にご連絡いたします。',
      id: 'contact_123456789',
      timestamp: '2024-12-19T07:35:44.548Z',
    });

    render(<ContactForm />);

    // フォーム要素の存在確認
    expect(screen.getByLabelText(/お名前/)).toBeInTheDocument();
    expect(screen.getByLabelText(/メールアドレス/)).toBeInTheDocument();
    expect(screen.getByLabelText(/電話番号/)).toBeInTheDocument();
    expect(screen.getByLabelText(/メッセージ/)).toBeInTheDocument();

    // フォームに入力
    await user.type(screen.getByLabelText(/お名前/), '統合テスト太郎');
    await user.type(
      screen.getByLabelText(/メールアドレス/),
      'integration@test.com'
    );
    await user.type(screen.getByLabelText(/電話番号/), '090-1234-5678');
    await user.type(
      screen.getByLabelText(/メッセージ/),
      'これは統合テスト用のメッセージです。フォーム送信フローをテストしています。'
    );

    // レッスンタイプを選択（実 UI のラベルは "希望レッスン"）
    await user.selectOptions(screen.getByLabelText(/希望レッスン/), 'group');

    // 送信ボタンをクリック
    const submitButton = screen.getByRole('button', { name: /送信/ });
    await user.click(submitButton);

    // API呼び出しの確認（ContactForm は camelCase で submit を呼ぶ）
    await waitFor(() => {
      expect(mockContactApi.submit).toHaveBeenCalledWith({
        name: '統合テスト太郎',
        email: 'integration@test.com',
        phone: '090-1234-5678',
        message:
          'これは統合テスト用のメッセージです。フォーム送信フローをテストしています。',
        preferredContact: 'email',
        lessonType: 'group',
      });
    });

    // フォームがリセットされることを確認
    await waitFor(() => {
      expect(screen.getByLabelText(/お名前/)).toHaveValue('');
      expect(screen.getByLabelText(/メールアドレス/)).toHaveValue('');
      expect(screen.getByLabelText(/電話番号/)).toHaveValue('');
      expect(screen.getByLabelText(/メッセージ/)).toHaveValue('');
    });
  });

  it('should not call API when form is empty', async () => {
    const user = userEvent.setup();

    render(<ContactForm />);

    // 空のフォームで送信ボタンは disabled
    const submitButton = screen.getByRole('button', { name: /送信/ });
    expect(submitButton).toBeDisabled();
    await user.click(submitButton);

    // APIが呼び出されないことを確認
    expect(mockContactApi.submit).not.toHaveBeenCalled();
  });

  it('should handle API errors gracefully', async () => {
    const user = userEvent.setup();

    // submit は { success: false, error } を返す（throw しない）
    mockContactApi.submit.mockResolvedValue({
      success: false,
      error: 'サーバーエラーが発生しました',
    });

    render(<ContactForm />);

    await user.type(screen.getByLabelText(/お名前/), 'エラーテスト太郎');
    await user.type(screen.getByLabelText(/メールアドレス/), 'error@test.com');
    await user.type(
      screen.getByLabelText(/メッセージ/),
      'エラーハンドリングのテストメッセージです。'
    );
    await user.selectOptions(screen.getByLabelText(/希望レッスン/), 'group');

    const submitButton = screen.getByRole('button', { name: /送信/ });
    await user.click(submitButton);

    // エラーメッセージの表示確認
    await waitFor(() => {
      expect(
        screen.getByText(/サーバーエラーが発生しました/)
      ).toBeInTheDocument();
    });

    // エラー時はフォームがリセットされない
    expect(screen.getByLabelText(/お名前/)).toHaveValue('エラーテスト太郎');
    expect(screen.getByLabelText(/メールアドレス/)).toHaveValue(
      'error@test.com'
    );
  });

  it('should validate email format on blur', async () => {
    const user = userEvent.setup();

    render(<ContactForm />);

    const emailInput = screen.getByLabelText(/メールアドレス/);

    await user.type(emailInput, 'invalid-email');
    await user.tab();

    // zod の email バリデーションメッセージ
    await waitFor(() => {
      expect(
        screen.getByText(/正しいメールアドレスを入力してください/)
      ).toBeInTheDocument();
    });

    // 修正
    await user.clear(emailInput);
    await user.type(emailInput, 'valid@email.com');
    await user.tab();

    await waitFor(() => {
      expect(
        screen.queryByText(/正しいメールアドレスを入力してください/)
      ).not.toBeInTheDocument();
    });
  });

  it('should validate message length on blur', async () => {
    const user = userEvent.setup();

    render(<ContactForm />);

    const messageInput = screen.getByLabelText(/メッセージ/);

    await user.type(messageInput, '短い');
    await user.tab();

    // zod の min(10) メッセージ
    await waitFor(() => {
      expect(
        screen.getByText(/メッセージは10文字以上で入力してください/)
      ).toBeInTheDocument();
    });

    await user.clear(messageInput);
    await user.type(messageInput, 'これは十分な長さのメッセージです。');
    await user.tab();

    await waitFor(() => {
      expect(
        screen.queryByText(/メッセージは10文字以上で入力してください/)
      ).not.toBeInTheDocument();
    });
  });
});
