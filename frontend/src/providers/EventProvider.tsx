/**
 * Event Provider
 * アプリケーション全体でのイベント処理を統合管理
 */

'use client';

import { useEffect } from 'react';
import { useNotificationStore } from '@/stores/notificationStore';
import { eventBus, EVENT_TYPES } from '@/utils/eventBus';

interface EventProviderProps {
  children: React.ReactNode;
}

export function EventProvider({ children }: EventProviderProps) {
  const { success, error, info } = useNotificationStore();

  useEffect(() => {
    // 成功イベントの処理
    const unsubscribeSuccess = eventBus.on(EVENT_TYPES.SUCCESS, (payload: { message: string }) => {
      success(payload.message);
    });

    // エラーイベントの処理
    const unsubscribeError = eventBus.on(EVENT_TYPES.ERROR, (payload: { message: string; source?: string }) => {
      error(payload.message, payload.source ? `エラー (${payload.source})` : 'エラー');
    });

    // 問い合わせ送信成功イベントの処理
    const unsubscribeContactSubmitted = eventBus.on(EVENT_TYPES.CONTACT_SUBMITTED, (payload: { 
      contactId: string; 
      email: string; 
      submittedAt: Date; 
    }) => {
      success(
        'お問い合わせを受け付けました。確認メールをお送りしましたのでご確認ください。',
        '送信完了'
      );
      
      // Google Analytics等のトラッキング（将来実装）
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'contact_form_submit', {
          event_category: 'engagement',
          event_label: 'contact_form'
        });
      }
    });

    // バリデーションエラーイベントの処理
    const unsubscribeValidationFailed = eventBus.on(EVENT_TYPES.CONTACT_VALIDATION_FAILED, (payload: { 
      errors: Record<string, string> 
    }) => {
      const errorMessages = Object.values(payload.errors);
      error(
        `入力内容に問題があります: ${errorMessages.join(', ')}`,
        '入力エラー'
      );
    });

    // フォームリセットイベントの処理
    const unsubscribeFormReset = eventBus.on(EVENT_TYPES.FORM_RESET, (payload: { formType: string }) => {
      info(`${payload.formType}フォームがリセットされました`);
    });

    // ナビゲーションイベントの処理（将来実装）
    const unsubscribeNavigation = eventBus.on(EVENT_TYPES.NAVIGATION, (payload: { path: string }) => {
      // ページ遷移時の処理
      console.log(`Navigating to: ${payload.path}`);
    });

    // クリーンアップ
    return () => {
      unsubscribeSuccess();
      unsubscribeError();
      unsubscribeContactSubmitted();
      unsubscribeValidationFailed();
      unsubscribeFormReset();
      unsubscribeNavigation();
    };
  }, [success, error, info]);

  return <>{children}</>;
}