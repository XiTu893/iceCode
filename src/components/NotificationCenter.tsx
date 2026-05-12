import React, { useState, useEffect } from 'react';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  timestamp: number;
  read: boolean;
  action?: {
    label: string;
    handler: () => void;
  };
}

interface NotificationCenterProps {
  notifications: Notification[];
  onMarkAsRead?: (id: string) => void;
  onDelete?: (id: string) => void;
  onClearAll?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  onMarkAsRead,
  onDelete,
  onClearAll,
  collapsed = false,
  onToggleCollapse,
}) => {
  const [filter, setFilter] = useState<'all' | 'unread' | Notification['type']>('all');

  // 过滤通知
  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !notification.read;
    return notification.type === filter;
  });

  // 统计未读数量
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className={`notification-center ${collapsed ? 'collapsed' : ''}`}>
      {/* 标题栏 */}
      {onToggleCollapse && (
        <div className="notification-header" onClick={onToggleCollapse}>
          <span className="title">🔔 通知中心</span>
          {unreadCount > 0 && (
            <span className="unread-badge">{unreadCount}</span>
          )}
          <span className="toggle-icon">{collapsed ? '▼' : '▲'}</span>
        </div>
      )}

      {/* 内容区域 */}
      {!collapsed && (
        <div className="notification-content">
          {/* 过滤器 */}
          <div className="notification-filters">
            <button
              className={`filter-button ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              全部
            </button>
            <button
              className={`filter-button ${filter === 'unread' ? 'active' : ''}`}
              onClick={() => setFilter('unread')}
            >
              未读 {unreadCount > 0 && `(${unreadCount})`}
            </button>
            <button
              className={`filter-button ${filter === 'success' ? 'active' : ''}`}
              onClick={() => setFilter('success')}
            >
              ✓ 成功
            </button>
            <button
              className={`filter-button ${filter === 'error' ? 'active' : ''}`}
              onClick={() => setFilter('error')}
            >
              ✗ 错误
            </button>
            <button
              className={`filter-button ${filter === 'warning' ? 'active' : ''}`}
              onClick={() => setFilter('warning')}
            >
              ⚠ 警告
            </button>
          </div>

          {/* 通知列表 */}
          <div className="notification-list">
            {filteredNotifications.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">📭</span>
                <p>暂无通知</p>
              </div>
            ) : (
              filteredNotifications.map(notification => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={onMarkAsRead}
                  onDelete={onDelete}
                />
              ))
            )}
          </div>

          {/* 底部操作 */}
          {notifications.length > 0 && (
            <div className="notification-footer">
              <button className="clear-button" onClick={onClearAll}>
                清空所有通知
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * 单个通知项组件
 */
interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onMarkAsRead,
  onDelete,
}) => {
  const icon = getNotificationIcon(notification.type);
  const timeStr = formatTime(notification.timestamp);

  const handleClick = () => {
    if (!notification.read && onMarkAsRead) {
      onMarkAsRead(notification.id);
    }
  };

  return (
    <div
      className={`notification-item ${notification.type} ${notification.read ? 'read' : 'unread'}`}
      onClick={handleClick}
    >
      {/* 图标 */}
      <div className="notification-icon">{icon}</div>

      {/* 内容 */}
      <div className="notification-body">
        <div className="notification-title">{notification.title}</div>
        <div className="notification-message">{notification.message}</div>
        <div className="notification-time">{timeStr}</div>
      </div>

      {/* 操作按钮 */}
      <div className="notification-actions">
        {notification.action && (
          <button
            className="action-button"
            onClick={(e) => {
              e.stopPropagation();
              notification.action!.handler();
            }}
          >
            {notification.action.label}
          </button>
        )}
        
        {onDelete && (
          <button
            className="delete-button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(notification.id);
            }}
            title="删除"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * 获取通知图标
 */
function getNotificationIcon(type: Notification['type']): string {
  const icons: Record<Notification['type'], string> = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
  };
  return icons[type];
}

/**
 * 格式化时间
 */
function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) {
    return '刚刚';
  } else if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes}分钟前`;
  } else if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}小时前`;
  } else {
    const days = Math.floor(diff / 86400000);
    return `${days}天前`;
  }
}

export default NotificationCenter;
