/**
 * Contact Store - Zustand State Management
 * 問い合わせフォームの状態管理とビジネスロジック
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Contact, ContactFormData, ContactValidationError } from '@/domain/contact';
import { eventBus, EVENT_TYPES } from '@/utils/eventBus';

interface ContactState {
  // State
  isSubmitting: boolean;
  isSuccess: boolean;
  error: string | null;
  validationErrors: Record<string, string>;
  formData: ContactFormData;

  // Actions
  updateFormData: (data: Partial<ContactFormData>) => void;
  submitContact: (contactData: ContactFormData) => Promise<void>;
  resetForm: () => void;
  clearError: () => void;
  setValidationErrors: (errors: Record<string, string>) => void;
}

const initialFormData: ContactFormData = {
  name: '',
  email: '',
  message: '',
  phone: '',
  lessonType: undefined,
  preferredContact: 'email'
};

export const useContactStore = create<ContactState>()(
  devtools(
    (set, get) => ({
      // Initial State
      isSubmitting: false,
      isSuccess: false,
      error: null,
      validationErrors: {},
      formData: initialFormData,

      // Actions
      updateFormData: (data) => {
        set((state) => ({
          formData: { ...state.formData, ...data },
          validationErrors: {}, // フォーム更新時にバリデーションエラーをクリア
          error: null
        }));
      },

      submitContact: async (contactData) => {
        set({ 
          isSubmitting: true, 
          error: null, 
          validationErrors: {},
          isSuccess: false 
        });

        try {
          // ドメインオブジェクト作成（バリデーション含む）
          const contact = new Contact(
            contactData.name,
            contactData.email,
            contactData.message,
            contactData.phone,
            contactData.lessonType,
            contactData.preferredContact
          );

          // API呼び出し
          const response = await fetch('/api/contact', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(contact.toApiPayload()),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || '送信に失敗しました');
          }

          const result = await response.json();

          // 成功時の処理
          set({ 
            isSubmitting: false, 
            isSuccess: true,
            formData: initialFormData // フォームをリセット
          });

          // 成功イベント発行
          const event = contact.submit();
          eventBus.emit(event.type, event.payload);

          // 成功通知イベント
          eventBus.emit(EVENT_TYPES.SUCCESS, {
            message: result.message || 'お問い合わせを送信しました'
          });

        } catch (error) {
          if (error instanceof ContactValidationError) {
            // バリデーションエラーの場合
            set({ 
              isSubmitting: false, 
              validationErrors: error.errors 
            });

            eventBus.emit(EVENT_TYPES.CONTACT_VALIDATION_FAILED, {
              errors: error.errors
            });
          } else {
            // その他のエラー
            const errorMessage = error instanceof Error 
              ? error.message 
              : 'エラーが発生しました';

            set({ 
              isSubmitting: false, 
              error: errorMessage 
            });

            eventBus.emit(EVENT_TYPES.ERROR, {
              message: errorMessage,
              source: 'contact_submission'
            });
          }
        }
      },

      resetForm: () => {
        set({
          formData: initialFormData,
          error: null,
          validationErrors: {},
          isSuccess: false,
          isSubmitting: false
        });

        eventBus.emit(EVENT_TYPES.FORM_RESET, {
          formType: 'contact'
        });
      },

      clearError: () => {
        set({ error: null, validationErrors: {} });
      },

      setValidationErrors: (errors) => {
        set({ validationErrors: errors });
      }
    }),
    {
      name: 'contact-store', // devtools用の名前
    }
  )
);

// セレクター関数（パフォーマンス最適化用）
export const useContactFormData = () => useContactStore((state) => state.formData);
export const useContactSubmitting = () => useContactStore((state) => state.isSubmitting);
export const useContactSuccess = () => useContactStore((state) => state.isSuccess);
export const useContactError = () => useContactStore((state) => state.error);
export const useContactValidationErrors = () => useContactStore((state) => state.validationErrors);