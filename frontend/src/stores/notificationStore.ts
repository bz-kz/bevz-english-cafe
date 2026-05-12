/**
 * Notification Store - Toast/Alert Management
 * 通知メッセージの状態管理
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { generateUUID } from '@/utils/uuid';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  duration?: number; // ms, 0 = 永続表示
  createdAt: Date;
}

interface NotificationState {
  notifications: Notification[];
  
  // Actions
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt'>) => string;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  
  // Convenience methods
  success: (message: string, title?: string, duration?: number) => string;
  error: (message: string, title?: string, duration?: number) => string;
  warning: (message: string, title?: string, duration?: number) => string;
  info: (message: string, title?: string, duration?: number) => string;
}

const DEFAULT_DURATION = 5000; // 5秒

export const useNotificationStore = create<NotificationState>()(
  devtools(
    (set, get) => ({
      notifications: [],

      addNotification: (notification) => {
        const id = generateUUID();
        const newNotification: Notification = {
          ...notification,
          id,
          createdAt: new Date(),
          duration: notification.duration ?? DEFAULT_DURATION
        };

        set((state) => ({
          notifications: [...state.notifications, newNotification]
        }));

        // 自動削除（duration > 0の場合）
        if (newNotification.duration && newNotification.duration > 0) {
          setTimeout(() => {
            get().removeNotification(id);
          }, newNotification.duration);
        }

        return id;
      },

      removeNotification: (id) => {
        set((state) => ({
          notifications: state.notifications.filter(n => n.id !== id)
        }));
      },

      clearAll: () => {
        set({ notifications: [] });
      },

      success: (message, title, duration) => {
        return get().addNotification({
          type: 'success',
          message,
          title,
          duration
        });
      },

      error: (message, title, duration = 0) => { // エラーは永続表示がデフォルト
        return get().addNotification({
          type: 'error',
          message,
          title,
          duration
        });
      },

      warning: (message, title, duration) => {
        return get().addNotification({
          type: 'warning',
          message,
          title,
          duration
        });
      },

      info: (message, title, duration) => {
        return get().addNotification({
          type: 'info',
          message,
          title,
          duration
        });
      }
    }),
    {
      name: 'notification-store'
    }
  )
);

// セレクター
export const useNotifications = () => useNotificationStore((state) => state.notifications);