/**
 * Notification Store Tests
 * 通知ストアのユニットテスト
 */

import { act, renderHook } from '@testing-library/react';
import { useNotificationStore } from '../notificationStore';

describe('NotificationStore', () => {
  beforeEach(() => {
    // 各テスト前にストアをリセット
    const { result } = renderHook(() => useNotificationStore());
    act(() => {
      result.current.clearAll();
    });
  });

  it('initializes with empty notifications', () => {
    const { result } = renderHook(() => useNotificationStore());
    expect(result.current.notifications).toEqual([]);
  });

  it('adds a notification', () => {
    const { result } = renderHook(() => useNotificationStore());

    act(() => {
      result.current.addNotification({
        type: 'success',
        title: 'Success',
        message: 'Operation completed successfully',
      });
    });

    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0]).toMatchObject({
      type: 'success',
      title: 'Success',
      message: 'Operation completed successfully',
    });
    expect(result.current.notifications[0].id).toBeDefined();
    expect(result.current.notifications[0].createdAt).toBeDefined();
  });

  it('adds multiple notifications', () => {
    const { result } = renderHook(() => useNotificationStore());

    act(() => {
      result.current.addNotification({
        type: 'success',
        title: 'Success 1',
        message: 'First success',
      });
      result.current.addNotification({
        type: 'error',
        title: 'Error 1',
        message: 'First error',
      });
    });

    expect(result.current.notifications).toHaveLength(2);
    expect(result.current.notifications[0].title).toBe('Success 1');
    expect(result.current.notifications[1].title).toBe('Error 1');
  });

  it('removes a notification by id', () => {
    const { result } = renderHook(() => useNotificationStore());

    let notificationId: string;

    act(() => {
      notificationId = result.current.addNotification({
        type: 'info',
        title: 'Info',
        message: 'Information message',
      });
    });

    expect(result.current.notifications).toHaveLength(1);

    act(() => {
      result.current.removeNotification(notificationId);
    });

    expect(result.current.notifications).toHaveLength(0);
  });

  it('clears all notifications', () => {
    const { result } = renderHook(() => useNotificationStore());

    act(() => {
      result.current.addNotification({
        type: 'success',
        title: 'Success',
        message: 'Success message',
      });
      result.current.addNotification({
        type: 'error',
        title: 'Error',
        message: 'Error message',
      });
    });

    expect(result.current.notifications).toHaveLength(2);

    act(() => {
      result.current.clearAll();
    });

    expect(result.current.notifications).toHaveLength(0);
  });

  it('generates unique ids for notifications', () => {
    const { result } = renderHook(() => useNotificationStore());

    act(() => {
      result.current.addNotification({
        type: 'info',
        title: 'Info 1',
        message: 'First info',
      });
      result.current.addNotification({
        type: 'info',
        title: 'Info 2',
        message: 'Second info',
      });
    });

    const ids = result.current.notifications.map(n => n.id);
    expect(ids[0]).not.toBe(ids[1]);
    expect(ids.every(id => typeof id === 'string' && id.length > 0)).toBe(true);
  });

  it('sets createdAt for notifications', () => {
    const { result } = renderHook(() => useNotificationStore());
    const beforeTime = new Date();

    act(() => {
      result.current.addNotification({
        type: 'warning',
        title: 'Warning',
        message: 'Warning message',
      });
    });

    const afterTime = new Date();
    const notification = result.current.notifications[0];
    
    expect(notification.createdAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
    expect(notification.createdAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
  });

  it('handles different notification types', () => {
    const { result } = renderHook(() => useNotificationStore());

    const notificationTypes = ['success', 'error', 'warning', 'info'] as const;

    act(() => {
      notificationTypes.forEach((type, index) => {
        result.current.addNotification({
          type,
          title: `${type} title`,
          message: `${type} message`,
        });
      });
    });

    expect(result.current.notifications).toHaveLength(4);
    notificationTypes.forEach((type, index) => {
      expect(result.current.notifications[index].type).toBe(type);
    });
  });

  it('handles optional duration property', () => {
    const { result } = renderHook(() => useNotificationStore());

    act(() => {
      result.current.addNotification({
        type: 'success',
        title: 'Success',
        message: 'Success with duration',
        duration: 5000,
      });
    });

    expect(result.current.notifications[0].duration).toBe(5000);
  });

  it('handles notification without duration (uses default)', () => {
    const { result } = renderHook(() => useNotificationStore());

    act(() => {
      result.current.addNotification({
        type: 'info',
        title: 'Info',
        message: 'Info without duration',
      });
    });

    expect(result.current.notifications[0].duration).toBe(5000); // デフォルト値
  });

  it('does not remove notification with non-existent id', () => {
    const { result } = renderHook(() => useNotificationStore());

    act(() => {
      result.current.addNotification({
        type: 'success',
        title: 'Success',
        message: 'Success message',
      });
    });

    expect(result.current.notifications).toHaveLength(1);

    act(() => {
      result.current.removeNotification('non-existent-id');
    });

    expect(result.current.notifications).toHaveLength(1);
  });

  it('maintains notification order (FIFO)', () => {
    const { result } = renderHook(() => useNotificationStore());

    act(() => {
      result.current.addNotification({
        type: 'info',
        title: 'First',
        message: 'First notification',
      });
      result.current.addNotification({
        type: 'info',
        title: 'Second',
        message: 'Second notification',
      });
      result.current.addNotification({
        type: 'info',
        title: 'Third',
        message: 'Third notification',
      });
    });

    expect(result.current.notifications[0].title).toBe('First');
    expect(result.current.notifications[1].title).toBe('Second');
    expect(result.current.notifications[2].title).toBe('Third');
  });
});