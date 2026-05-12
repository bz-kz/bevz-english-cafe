/**
 * Event Bus Implementation
 * アプリケーション全体でのイベント駆動アーキテクチャを支援
 */

type EventHandler<T = any> = (payload: T) => void;

export class EventBus {
  private handlers: Map<string, EventHandler[]> = new Map();

  /**
   * イベントを発行する
   */
  emit<T>(eventType: string, payload: T): void {
    const eventHandlers = this.handlers.get(eventType) || [];
    eventHandlers.forEach(handler => {
      try {
        handler(payload);
      } catch (error) {
        console.error(`Error in event handler for ${eventType}:`, error);
      }
    });
  }

  /**
   * イベントハンドラーを登録する
   */
  on<T>(eventType: string, handler: EventHandler<T>): () => void {
    const handlers = this.handlers.get(eventType) || [];
    handlers.push(handler);
    this.handlers.set(eventType, handlers);

    // アンサブスクライブ関数を返す
    return () => {
      const currentHandlers = this.handlers.get(eventType) || [];
      const index = currentHandlers.indexOf(handler);
      if (index > -1) {
        currentHandlers.splice(index, 1);
        if (currentHandlers.length === 0) {
          this.handlers.delete(eventType);
        } else {
          this.handlers.set(eventType, currentHandlers);
        }
      }
    };
  }

  /**
   * 一度だけ実行されるイベントハンドラーを登録する
   */
  once<T>(eventType: string, handler: EventHandler<T>): () => void {
    const onceHandler = (payload: T) => {
      handler(payload);
      unsubscribe();
    };

    const unsubscribe = this.on(eventType, onceHandler);
    return unsubscribe;
  }

  /**
   * 特定のイベントタイプのすべてのハンドラーを削除する
   */
  off(eventType: string): void {
    this.handlers.delete(eventType);
  }

  /**
   * すべてのイベントハンドラーを削除する
   */
  clear(): void {
    this.handlers.clear();
  }

  /**
   * 登録されているイベントタイプの一覧を取得する
   */
  getEventTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * 特定のイベントタイプのハンドラー数を取得する
   */
  getHandlerCount(eventType: string): number {
    return this.handlers.get(eventType)?.length || 0;
  }
}

// シングルトンインスタンス
export const eventBus = new EventBus();

// よく使用されるイベントタイプの定数
export const EVENT_TYPES = {
  CONTACT_SUBMITTED: 'CONTACT_SUBMITTED',
  CONTACT_VALIDATION_FAILED: 'CONTACT_VALIDATION_FAILED',
  FORM_RESET: 'FORM_RESET',
  NAVIGATION: 'NAVIGATION',
  ERROR: 'ERROR',
  SUCCESS: 'SUCCESS'
} as const;

export type EventType = typeof EVENT_TYPES[keyof typeof EVENT_TYPES];