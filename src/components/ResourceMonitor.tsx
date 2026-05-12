import React, { useEffect, useState } from 'react';
import { systemMonitor, type SystemStats } from '../../services/monitoring/SystemMonitor.js';

interface ResourceMonitorProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const ResourceMonitor: React.FC<ResourceMonitorProps> = ({
  collapsed = false,
  onToggleCollapse,
}) => {
  const [stats, setStats] = useState<SystemStats | null>(null);

  useEffect(() => {
    // 启动系统监控
    systemMonitor.start(1000);

    // 订阅统计数据
    const unsubscribe = systemMonitor.addListener((newStats) => {
      setStats(newStats);
    });

    // 清理
    return () => {
      unsubscribe();
      systemMonitor.stop();
    };
  }, []);

  if (!stats) {
    return (
      <div className="resource-monitor loading">
        <span>加载中...</span>
      </div>
    );
  }

  const cpuColor = getCPUColor(stats.cpu.usage);
  const memoryColor = getMemoryColor(stats.memory.percentage);

  return (
    <div className={`resource-monitor ${collapsed ? 'collapsed' : ''}`}>
      {/* 标题栏 */}
      {onToggleCollapse && (
        <div className="resource-monitor-header" onClick={onToggleCollapse}>
          <span className="title">📊 资源监控</span>
          <span className="toggle-icon">{collapsed ? '▼' : '▲'}</span>
        </div>
      )}

      {/* 内容区域 */}
      {!collapsed && (
        <div className="resource-monitor-content">
          {/* CPU使用率 */}
          <div className="resource-item">
            <div className="resource-label">
              <span className="icon">💻</span>
              <span>CPU</span>
            </div>
            <div className="resource-value">
              <ProgressBar 
                value={stats.cpu.usage} 
                color={cpuColor}
                showText={true}
              />
              <span className="detail">
                {stats.cpu.cores}核 | {stats.cpu.speed}MHz
              </span>
            </div>
          </div>

          {/* 内存使用 */}
          <div className="resource-item">
            <div className="resource-label">
              <span className="icon">🧠</span>
              <span>内存</span>
            </div>
            <div className="resource-value">
              <ProgressBar 
                value={stats.memory.percentage} 
                color={memoryColor}
                showText={true}
              />
              <span className="detail">
                {formatBytes(stats.memory.used)} / {formatBytes(stats.memory.total)}
              </span>
            </div>
          </div>

          {/* 网络状态 */}
          <div className="resource-item">
            <div className="resource-label">
              <span className="icon">🌐</span>
              <span>网络</span>
            </div>
            <div className="resource-value">
              <span className={`status-badge ${stats.network.connected ? 'connected' : 'disconnected'}`}>
                {stats.network.connected ? '✓ 已连接' : '✗ 未连接'}
              </span>
              {stats.network.latency && (
                <span className="detail">{stats.network.latency}ms</span>
              )}
            </div>
          </div>

          {/* 系统运行时间 */}
          <div className="resource-item">
            <div className="resource-label">
              <span className="icon">⏱️</span>
              <span>运行时间</span>
            </div>
            <div className="resource-value">
              <span>{formatUptime(stats.uptime)}</span>
            </div>
          </div>

          {/* 负载平均值 */}
          <div className="resource-item">
            <div className="resource-label">
              <span className="icon">📈</span>
              <span>负载</span>
            </div>
            <div className="resource-value">
              <span className="detail">
                {stats.loadAverage.map(l => l.toFixed(2)).join(' | ')}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * 进度条组件
 */
interface ProgressBarProps {
  value: number;
  color: string;
  showText?: boolean;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ value, color, showText = true }) => {
  const bars = Math.round(value / 10);
  const emptyBars = 10 - bars;
  
  return (
    <div className="progress-bar-container">
      <div className="progress-bar">
        <span className="filled" style={{ color }}>
          {'█'.repeat(bars)}
        </span>
        <span className="empty">
          {'░'.repeat(emptyBars)}
        </span>
      </div>
      {showText && (
        <span className="percentage" style={{ color }}>
          {value.toFixed(1)}%
        </span>
      )}
    </div>
  );
};

/**
 * 获取CPU颜色
 */
function getCPUColor(usage: number): string {
  if (usage < 50) return '#4ade80'; // 绿色
  if (usage < 80) return '#fbbf24'; // 黄色
  return '#f87171'; // 红色
}

/**
 * 获取内存颜色
 */
function getMemoryColor(usage: number): string {
  if (usage < 60) return '#4ade80'; // 绿色
  if (usage < 85) return '#fbbf24'; // 黄色
  return '#f87171'; // 红色
}

/**
 * 格式化字节数
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * 格式化运行时间
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days}天 ${hours}小时`;
  } else if (hours > 0) {
    return `${hours}小时 ${minutes}分钟`;
  } else {
    return `${minutes}分钟`;
  }
}

export default ResourceMonitor;
