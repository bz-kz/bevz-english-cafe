/**
 * 問い合わせフォーム統合テスト
 * フォーム送信フロー全体の統合テスト
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ContactForm from '@/components/forms/ContactForm';
import { contactApi } from '@/lib/api';

// APIをモック化
jest.mock('@/lib/api', () => ({
  contactApi: {
    submitContact: jest.fn()
  }
}));

const mockContactApi = contactApi as jest.Mocked<typeof contactApi>;

describe('Contact Form Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should complete full form submission flow successfully', async () => {
    const user = userEvent.setup();
    
    // 成功レスポンスをモック
    mockContactApi.submitContact.mockResolvedValue({
      success: true,
      message: 'お問い合わせを受け付けました。2営業日以内にご連絡いたします。',
      id: 'contact_123456789',
      timestamp: '2024-12-19T07:35:44.548Z'
    });

    render(<ContactForm />);

    // フォーム要素の存在確認
    expect(screen.getByLabelText(/お名前/)).toBeInTheDocument();
    expect(screen.getByLabelText(/メールアドレス/)).toBeInTheDocument();
    expect(screen.getByLabelText(/電話番号/)).toBeInTheDocument();
    expect(screen.getByLabelText(/メッセージ/)).toBeInTheDocument();

    // フォームに入力
    await user.type(screen.getByLabelText(/お名前/), '統合テスト太郎');
    await user.type(screen.getByLabelText(/メールアドレス/), 'integration@test.com');
    await user.type(screen.getByLabelText(/電話番号/), '090-1234-5678');
    await user.type(
      screen.getByLabelText(/メッセージ/), 
      'これは統合テスト用のメッセージです。フォーム送信フローをテストしています。'
    );

    // 希望連絡方法を選択
    await user.selectOptions(screen.getByLabelText(/希望連絡方法/), 'email');
    
    // レッスンタイプを選択
    await user.selectOptions(screen.getByLabelText(/興味のあるレッスン/), 'group');

    // 送信ボタンをクリック
    const submitButton = screen.getByRole('button', { name: /送信/ });
    await user.click(submitButton);

    // ローディング状態の確認
    await waitFor(() => {
      expect(screen.getByText(/送信中/)).toBeInTheDocument();
    });

    // API呼び出しの確認
    await waitFor(() => {
      expect(mockContactApi.submitContact).toHaveBeenCalledWith({
        name: '統合テスト太郎',
        email: 'integration@test.com',
        phone: '090-1234-5678',
        message: 'これは統合テスト用のメッセージです。フォーム送信フローをテストしています。',
        preferredContact: 'email',
        lessonType: 'group'
      });
    });

    // 成功メッセージの表示確認
    await waitFor(() => {
      expect(screen.getByText(/お問い合わせを受け付けました/)).toBeInTheDocument();
    });

    // フォームがリセットされることを確認
    await waitFor(() => {
      expect(screen.getByLabelText(/お名前/)).toHaveValue('');
      expect(screen.getByLabelText(/メールアドレス/)).toHaveValue('');
      expect(screen.getByLabelText(/電話番号/)).toHaveValue('');
      expect(screen.getByLabelText(/メッセージ/)).toHaveValue('');
    });
  });

  it('should handle form validation errors', async () => {
    const user = userEvent.setup();
    
    render(<ContactForm />);

    // 空のフォームで送信を試行
    const submitButton = screen.getByRole('button', { name: /送信/ });
    await user.click(submitButton);

    // バリデーションエラーメッセージの確認
    await waitFor(() => {
      expect(screen.getByText(/お名前は必須です/)).toBeInTheDocument();
      expect(screen.getByText(/メールアドレスは必須です/)).toBeInTheDocument();
      expect(screen.getByText(/メッセージは必須です/)).toBeInTheDocument();
    });

    // APIが呼び出されないことを確認
    expect(mockContactApi.submitContact).not.toHaveBeenCalled();
  });

  it('should handle API errors gracefully', async () => {
    const user = userEvent.setup();
    
    // エラーレスポンスをモック
    mockContactApi.submitContact.mockRejectedValue(new Error('サーバーエラーが発生しました'));

    render(<ContactForm />);

    // 有効なデータを入力
    await user.type(screen.getByLabelText(/お名前/), 'エラーテスト太郎');
    await user.type(screen.getByLabelText(/メールアドレス/), 'error@test.com');
    await user.type(
      screen.getByLabelText(/メッセージ/), 
      'エラーハンドリングのテストメッセージです。'
    );

    // 送信ボタンをクリック
    const submitButton = screen.getByRole('button', { name: /送信/ });
    await user.click(submitButton);

    // エラーメッセージの表示確認
    await waitFor(() => {
      expect(screen.getByText(/サーバーエラーが発生しました/)).toBeInTheDocument();
    });

    // フォームがリセットされないことを確認（エラー時はデータを保持）
    expect(screen.getByLabelText(/お名前/)).toHaveValue('エラーテスト太郎');
    expect(screen.getByLabelText(/メールアドレス/)).toHaveValue('error@test.com');
  });

  it('should validate email format in real-time', async () => {
    const user = userEvent.setup();
    
    render(<ContactForm />);

    const emailInput = screen.getByLabelText(/メールアドレス/);
    
    // 無効なメールアドレスを入力
    await user.type(emailInput, 'invalid-email');
    await user.tab(); // フォーカスを外す

    // バリデーションエラーメッセージの確認
    await waitFor(() => {
      expect(screen.getByText(/有効なメールアドレスを入力してください/)).toBeInTheDocument();
    });

    // 有効なメールアドレスに修正
    await user.clear(emailInput);
    await user.type(emailInput, 'valid@email.com');
    await user.tab();

    // エラーメッセージが消えることを確認
    await waitFor(() => {
      expect(screen.queryByText(/有効なメールアドレスを入力してください/)).not.toBeInTheDocument();
    });
  });

  it('should validate message length in real-time', async () => {
    const user = userEvent.setup();
    
    render(<ContactForm />);

    const messageInput = screen.getByLabelText(/メッセージ/);
    
    // 短すぎるメッセージを入力
    await user.type(messageInput, '短い');
    await user.tab();

    // バリデーションエラーメッセージの確認
    await waitFor(() => {
      expect(screen.getByText(/メッセージは10文字以上で入力してください/)).toBeInTheDocument();
    });

    // 十分な長さのメッセージに修正
    await user.clear(messageInput);
    await user.type(messageInput, 'これは十分な長さのメッセージです。');
    await user.tab();

    // エラーメッセージが消えることを確認
    await waitFor(() => {
      expect(screen.queryByText(/メッセージは10文字以上で入力してください/)).not.toBeInTheDocument();
    });
  });

  it('should handle form submission with all optional fields', async () => {
    const user = userEvent.setup();
    
    // 成功レスポンスをモック
    mockContactApi.submitContact.mockResolvedValue({
      success: true,
      message: 'お問い合わせを受け付けました。',
      id: 'contact_full_123',
      timestamp: '2024-12-19T07:35:44.548Z'
    });

    render(<ContactForm />);

    // 全フィールドに入力
    await user.type(screen.getByLabelText(/お名前/), 'フルテスト太郎');
    await user.type(screen.getByLabelText(/メールアドレス/), 'full@test.com');
    await user.type(screen.getByLabelText(/電話番号/), '090-9876-5432');
    await user.type(
      screen.getByLabelText(/メッセージ/), 
      'すべてのフィールドを入力したテストメッセージです。'
    );
    await user.selectOptions(screen.getByLabelText(/希望連絡方法/), 'phone');
    await user.selectOptions(screen.getByLabelText(/興味のあるレッスン/), 'private');

    // 送信
    await user.click(screen.getByRole('button', { name: /送信/ }));

    // 全データが正しく送信されることを確認
    await waitFor(() => {
      expect(mockContactApi.submitContact).toHaveBeenCalledWith({
        name: 'フルテスト太郎',
        email: 'full@test.com',
        phone: '090-9876-5432',
        message: 'すべてのフィールドを入力したテストメッセージです。',
        preferredContact: 'phone',
        lessonType: 'private'
      });
    });
  });
});