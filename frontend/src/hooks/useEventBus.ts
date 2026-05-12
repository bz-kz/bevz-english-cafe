/**
 * Event Bus React Hook
 * Reactコンポーネントでイベントバスを使用するためのフック
 */

import { useEffect, useRef } from 'react';
import { eventBus, EventType } from '@/utils/eventBus';

/**
 * イベントリスナーを登録するフック
 */
export function useEventListener<T = any>(
  eventType: EventType | string,
  handler: (payload: T) => void,
  deps: React.DependencyList = []
) {
  const handlerRef = useRef(handler);

  // ハンドラーの最新版を保持
  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    const wrappedHandler = (payload: T) => {
      handlerRef.current(payload);
    };

    const unsubscribe = eventBus.on(eventType, wrappedHandler);

    return unsubscribe;
  }, [eventType, ...deps]);
}

/**
 * イベントを発行するためのフック
 */
export function useEventEmitter() {
  return {
    emit: eventBus.emit.bind(eventBus),
    emitSuccess: (message: string) => {
      eventBus.emit('SUCCESS', { message });
    },
    emitError: (message: string, source?: string) => {
      eventBus.emit('ERROR', { message, source });
    },
    emitNavigation: (path: string) => {
      eventBus.emit('NAVIGATION', { path });
    }
  };
}

/**
 * 一度だけ実行されるイベントリスナーを登録するフック
 */
export function useEventListenerOnce<T = any>(
  eventType: EventType | string,
  handler: (payload: T) => void,
  deps: React.DependencyList = []
) {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    const wrappedHandler = (payload: T) => {
      handlerRef.current(payload);
    };

    const unsubscribe = eventBus.once(eventType, wrappedHandler);

    return unsubscribe;
  }, [eventType, ...deps]);
}