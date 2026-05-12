/**
 * Contact Form Component
 * 問い合わせフォームコンポーネント（リアルタイムバリデーション、送信状態管理付き）
 */

'use client';

import { useState, useEffect } from 'react';
import { useNotificationStore } from '@/stores/notificationStore';
import { Input, Textarea, Select, Button, Spinner } from '@/components/ui';
import { contactApi } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ContactFormData {
  name: string;
  email: string;
  phone: string;
  lessonType: 'group' | 'private' | 'trial' | 'other' | '';
  preferredContact: 'email' | 'phone' | 'line' | 'facebook' | 'instagram';
  message: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  lessonType?: string;
  preferredContact?: string;
  message?: string;
}

const lessonTypeOptions = [
  { value: '', label: '選択してください' },
  { value: 'trial', label: '無料体験レッスン' },
  { value: 'group', label: 'グループレッスン' },
  { value: 'private', label: 'プライベートレッスン' },
  { value: 'business', label: 'ビジネス英語' },
  { value: 'toeic', label: 'TOEIC対策' },
  { value: 'online', label: 'オンラインレッスン' },
  { value: 'other', label: 'その他・相談' }
];

const preferredContactOptions = [
  { value: 'email', label: 'メール' },
  { value: 'phone', label: '電話' },
  { value: 'line', label: 'LINE' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' }
];

interface ContactFormProps {
  className?: string;
  onSuccess?: () => void;
}

export function ContactForm({ className, onSuccess }: ContactFormProps) {
  const { addNotification } = useNotificationStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    email: '',
    phone: '',
    lessonType: '',
    preferredContact: 'email',
    message: ''
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isFormValid, setIsFormValid] = useState(false);

  // リアルタイムバリデーション
  const validateField = (name: string, value: string): string | undefined => {
    switch (name) {
      case 'name':
        if (!value.trim()) return 'お名前は必須です';
        if (value.trim().length < 2) return 'お名前は2文字以上で入力してください';
        return undefined;

      case 'email':
        if (!value.trim()) return 'メールアドレスは必須です';
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) return '有効なメールアドレスを入力してください';
        return undefined;

      case 'phone':
        if (value && !/^[\d\-\(\)\+\s]+$/.test(value)) {
          return '有効な電話番号を入力してください';
        }
        return undefined;

      case 'lessonType':
        if (!value) return 'レッスンタイプを選択してください';
        return undefined;

      case 'preferredContact':
        if (!value) return '希望連絡方法を選択してください';
        return undefined;

      case 'message':
        if (!value.trim()) return 'メッセージは必須です';
        if (value.trim().length < 10) return 'メッセージは10文字以上で入力してください';
        if (value.trim().length > 1000) return 'メッセージは1000文字以内で入力してください';
        return undefined;

      default:
        return undefined;
    }
  };

  // フォーム全体のバリデーション
  const validateForm = (data: ContactFormData): FormErrors => {
    const newErrors: FormErrors = {};

    Object.keys(data).forEach(key => {
      const error = validateField(key, data[key as keyof ContactFormData]);
      if (error) {
        newErrors[key as keyof FormErrors] = error;
      }
    });

    return newErrors;
  };

  // フィールド値変更ハンドラー
  const handleFieldChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));

    // リアルタイムバリデーション（フィールドがタッチされている場合のみ）
    if (touched[name]) {
      const error = validateField(name, value);
      setErrors(prev => ({ ...prev, [name]: error }));
    }
  };

  // フィールドブラーハンドラー
  const handleFieldBlur = (name: string) => {
    setTouched(prev => ({ ...prev, [name]: true }));
    const error = validateField(name, formData[name as keyof ContactFormData]);
    setErrors(prev => ({ ...prev, [name]: error }));
  };

  // フォームバリデーション状態の更新
  useEffect(() => {
    const formErrors = validateForm(formData);
    const hasErrors = Object.values(formErrors).some(error => error !== undefined);
    const hasRequiredFields = formData.name && formData.email && formData.lessonType && formData.message;

    setIsFormValid(!hasErrors && !!hasRequiredFields);
  }, [formData]);

  // フォーム送信ハンドラー
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 全フィールドをタッチ済みにマーク
    const allFields = Object.keys(formData);
    setTouched(allFields.reduce((acc, field) => ({ ...acc, [field]: true }), {}));

    // バリデーション
    const formErrors = validateForm(formData);
    setErrors(formErrors);

    if (Object.values(formErrors).some(error => error !== undefined)) {
      addNotification({
        type: 'error',
        title: '入力エラー',
        message: '入力内容を確認してください'
      });
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // バックエンドAPIに送信
      const response = await contactApi.submit({
        name: formData.name,
        email: formData.email,
        phone: formData.phone || undefined,
        lessonType: formData.lessonType,
        preferredContact: formData.preferredContact,
        message: formData.message
      });

      if (response.success) {
        // 成功時の処理
        addNotification({
          type: 'success',
          title: '送信完了',
          message: 'お問い合わせを受け付けました。確認メールをお送りしましたのでご確認ください。'
        });
      } else {
        throw new Error(response.error || '送信に失敗しました');
      }

      // フォームリセット
      setFormData({
        name: '',
        email: '',
        phone: '',
        lessonType: '',
        preferredContact: 'email',
        message: ''
      });
      setErrors({});
      setTouched({});

      onSuccess?.();

    } catch (err: any) {
      console.error('Contact form submission error:', err);

      const errorMessage = err.message || 'お問い合わせの送信に失敗しました。しばらく時間をおいて再度お試しください。';

      setError(errorMessage);
      addNotification({
        type: 'error',
        title: '送信エラー',
        message: errorMessage
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-6', className)}>
      {/* お名前 */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
          お名前 <span className="text-red-500">*</span>
        </label>
        <Input
          id="name"
          name="name"
          type="text"
          value={formData.name}
          onChange={(e) => handleFieldChange('name', e.target.value)}
          onBlur={() => handleFieldBlur('name')}
          placeholder="山田太郎"
          error={touched.name ? errors.name : undefined}
          required
        />
      </div>

      {/* メールアドレス */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
          メールアドレス <span className="text-red-500">*</span>
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          value={formData.email}
          onChange={(e) => handleFieldChange('email', e.target.value)}
          onBlur={() => handleFieldBlur('email')}
          placeholder="example@email.com"
          error={touched.email ? errors.email : undefined}
          required
        />
      </div>

      {/* 電話番号 */}
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
          電話番号
        </label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          value={formData.phone}
          onChange={(e) => handleFieldChange('phone', e.target.value)}
          onBlur={() => handleFieldBlur('phone')}
          placeholder="090-1234-5678"
          error={touched.phone ? errors.phone : undefined}
        />
        <p className="mt-1 text-xs text-gray-500">
          電話での連絡をご希望の場合は入力してください
        </p>
      </div>

      {/* 希望レッスン */}
      <div>
        <label htmlFor="lessonType" className="block text-sm font-medium text-gray-700 mb-2">
          希望レッスン <span className="text-red-500">*</span>
        </label>
        <Select
          id="lessonType"
          name="lessonType"
          value={formData.lessonType}
          onChange={(e) => handleFieldChange('lessonType', e.target.value)}
          onBlur={() => handleFieldBlur('lessonType')}
          options={lessonTypeOptions}
          error={touched.lessonType ? errors.lessonType : undefined}
          required
        />
      </div>

      {/* 希望連絡方法 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          希望連絡方法 <span className="text-red-500">*</span>
        </label>
        <div className="space-y-2">
          {preferredContactOptions.map((option) => (
            <label key={option.value} className="flex items-center">
              <input
                type="radio"
                name="preferredContact"
                value={option.value}
                checked={formData.preferredContact === option.value}
                onChange={(e) => handleFieldChange('preferredContact', e.target.value)}
                className="mr-3 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
              />
              <span className="text-sm text-gray-700">{option.label}</span>
            </label>
          ))}
        </div>
        {touched.preferredContact && errors.preferredContact && (
          <p className="mt-1 text-sm text-red-600">{errors.preferredContact}</p>
        )}
      </div>

      {/* メッセージ */}
      <div>
        <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
          メッセージ <span className="text-red-500">*</span>
        </label>
        <Textarea
          id="message"
          name="message"
          rows={5}
          value={formData.message}
          onChange={(e) => handleFieldChange('message', e.target.value)}
          onBlur={() => handleFieldBlur('message')}
          placeholder="ご質問やご要望をお聞かせください&#10;&#10;例：&#10;・英語レベル：初心者&#10;・学習目標：日常会話ができるようになりたい&#10;・希望する曜日・時間帯：平日の夜&#10;・その他ご質問など"
          error={touched.message ? errors.message : undefined}
          required
        />
        <div className="mt-1 flex justify-between text-xs text-gray-500">
          <span>10文字以上1000文字以内で入力してください</span>
          <span className={cn(
            formData.message.length > 1000 ? 'text-red-500' : 'text-gray-500'
          )}>
            {formData.message.length}/1000
          </span>
        </div>
      </div>

      {/* エラーメッセージ */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex">
            <svg className="w-5 h-5 text-red-400 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-red-800">送信エラー</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* 送信ボタン */}
      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={!isFormValid || isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Spinner size="sm" className="mr-2" />
            送信中...
          </>
        ) : (
          '送信する'
        )}
      </Button>

      {/* 注意事項 */}
      <div className="text-xs text-gray-500 space-y-1">
        <p>• 送信いただいた内容は、お問い合わせ対応のみに使用いたします。</p>
        <p>• 通常1営業日以内にご返信いたします。</p>
        <p>• お急ぎの場合は、お電話でもお問い合わせいただけます。</p>
      </div>
    </form>
  );
}