/**
 * ContactForm Component Tests
 * 問い合わせフォームコンポーネントのユニットテスト
 */

import { render, screen } from '@testing-library/react';
import { ContactForm } from '../ContactForm';

// APIモック
jest.mock('@/lib/api', () => ({
  contactApi: {
    submitContact: jest.fn(),
  },
}));

// 通知ストアモック
const mockAddNotification = jest.fn();
jest.mock('@/stores/notificationStore', () => ({
  useNotificationStore: () => ({
    addNotification: mockAddNotification,
  }),
}));

describe('ContactForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders contact form', () => {
    render(<ContactForm />);

    expect(screen.getByLabelText(/お名前/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/メールアドレス/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/電話番号/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/メッセージ/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /送信/i })).toBeInTheDocument();
  });

  it('renders form fields with correct types', () => {
    render(<ContactForm />);

    const nameInput = screen.getByLabelText(/お名前/i);
    const emailInput = screen.getByLabelText(/メールアドレス/i);
    const phoneInput = screen.getByLabelText(/電話番号/i);
    const messageInput = screen.getByLabelText(/メッセージ/i);

    expect(nameInput).toHaveAttribute('type', 'text');
    expect(emailInput).toHaveAttribute('type', 'email');
    expect(phoneInput).toHaveAttribute('type', 'tel');
    expect(messageInput.tagName.toLowerCase()).toBe('textarea');
  });

  it('has required fields marked as required', () => {
    render(<ContactForm />);

    expect(screen.getByLabelText(/お名前/i)).toBeRequired();
    expect(screen.getByLabelText(/メールアドレス/i)).toBeRequired();
    expect(screen.getByLabelText(/メッセージ/i)).toBeRequired();
  });
});