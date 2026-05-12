/**
 * 桌面通知服务
 * 
 * 使用Electron Notification API发送系统通知
 */

import { Notification } from 'electron';

export type NotificationType = 
  | 'task_completed'
  | 'task_failed'
  | 'task_cancelled'
  | 'system_warning'
  | 'system_error'
  | 'info';

export interface NotificationOptions {
  title: string;
  body: string;
  type?: NotificationType;
  icon?: string;
  urgency?: 'low' | 'normal' | 'critical';
  timeout?: number; // 显示时长（毫秒），0表示不自动关闭
  onClick?: () => void;
  onClose?: () => void;
}

export class DesktopNotificationService {
  private enabled: boolean = true;
  private recentNotifications: Map<string, number> = new Map();
  private cooldownPeriod: number = 2000; // 相同通知的最小间隔（毫秒）

  /**
   * 启用/禁用通知
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    console.log(`[Notification] ${enabled ? 'Enabled' : 'Disabled'}`);
  }

  /**
   * 检查是否已启用
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * 发送通知
   */
  send(options: NotificationOptions): void {
    if (!this.enabled) {
      console.log('[Notification] Disabled, skipping:', options.title);
      return;
    }

    // 频率限制：防止相同通知过于频繁
    const notificationKey = `${options.title}:${options.body}`;
    const now = Date.now();
    const lastSent = this.recentNotifications.get(notificationKey);

    if (lastSent && (now - lastSent < this.cooldownPeriod)) {
      console.log('[Notification] Cooldown active, skipping:', options.title);
      return;
    }

    this.recentNotifications.set(notificationKey, now);

    // 清理过期的冷却记录
    this.cleanupCooldowns(now);

    try {
      const notification = new Notification({
        title: options.title,
        body: options.body,
        icon: options.icon || this.getDefaultIcon(options.type),
        urgency: options.urgency || 'normal',
        timeoutType: options.timeout === 0 ? 'never' : 'default',
      });

      // 点击事件
      if (options.onClick) {
        notification.on('click', () => {
          options.onClick!();
        });
      }

      // 关闭事件
      if (options.onClose) {
        notification.on('close', () => {
          options.onClose!();
        });
      }

      // 显示通知
      notification.show();

      // 自动关闭（如果设置了timeout）
      if (options.timeout && options.timeout > 0) {
        setTimeout(() => {
          notification.close();
        }, options.timeout);
      }

      console.log(`[Notification] Sent: ${options.title}`);
    } catch (error) {
      console.error('[Notification] Failed to send:', error);
    }
  }

  /**
   * 发送任务完成通知
   */
  notifyTaskCompleted(taskName: string, details?: string): void {
    this.send({
      title: '✅ 任务完成',
      body: details ? `${taskName}\n${details}` : taskName,
      type: 'task_completed',
      urgency: 'normal',
      timeout: 5000,
    });
  }

  /**
   * 发送任务失败通知
   */
  notifyTaskFailed(taskName: string, error: string): void {
    this.send({
      title: '❌ 任务失败',
      body: `${taskName}\n错误: ${error}`,
      type: 'task_failed',
      urgency: 'critical',
      timeout: 10000,
    });
  }

  /**
   * 发送任务取消通知
   */
  notifyTaskCancelled(taskName: string): void {
    this.send({
      title: '⚠️ 任务已取消',
      body: taskName,
      type: 'task_cancelled',
      urgency: 'low',
      timeout: 3000,
    });
  }

  /**
   * 发送系统警告
   */
  notifyWarning(title: string, message: string): void {
    this.send({
      title: `⚠️ ${title}`,
      body: message,
      type: 'system_warning',
      urgency: 'normal',
      timeout: 8000,
    });
  }

  /**
   * 发送系统错误
   */
  notifyError(title: string, message: string): void {
    this.send({
      title: `🔴 ${title}`,
      body: message,
      type: 'system_error',
      urgency: 'critical',
      timeout: 15000,
    });
  }

  /**
   * 发送信息通知
   */
  notifyInfo(title: string, message: string): void {
    this.send({
      title: `ℹ️ ${title}`,
      body: message,
      type: 'info',
      urgency: 'low',
      timeout: 4000,
    });
  }

  /**
   * 获取默认图标
   */
  private getDefaultIcon(type?: NotificationType): string {
    // 可以根据不同类型返回不同图标
    // 目前使用默认图标
    return '';
  }

  /**
   * 清理过期的冷却记录
   */
  private cleanupCooldowns(now: number): void {
    for (const [key, timestamp] of this.recentNotifications.entries()) {
      if (now - timestamp > this.cooldownPeriod * 2) {
        this.recentNotifications.delete(key);
      }
    }
  }

  /**
   * 设置冷却期
   */
  setCooldownPeriod(ms: number): void {
    this.cooldownPeriod = ms;
  }

  /**
   * 清除所有冷却记录
   */
  clearCooldowns(): void {
    this.recentNotifications.clear();
  }
}

// 导出单例实例
export const desktopNotificationService = new DesktopNotificationService();
