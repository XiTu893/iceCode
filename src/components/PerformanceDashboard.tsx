import React, { useState, useEffect } from 'react';
import { performanceMonitor, type PerformanceMetric } from '../services/performance/PerformanceMonitor.js';
import { memoryLeakDetector } from '../utils/performanceUtils.js';

import '../components/PerformanceDashboard.css';

interface PerformanceDashboardProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
  collapsed = false,
  onToggleCollapse,
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [leakStatus, setLeakStatus] = useState<{
    hasLeak: boolean;
    growthMB: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  }>({ hasLeak: false, growthMB: 0, trend: 'stable' });

  useEffect(() => {
    // 启动性能监控
    performanceMonitor.start(2000);
    
    // 记录基线内存
    memoryLeakDetector.recordBaseline();

    // 订阅性能数据
    const unsubscribe = performanceMonitor.addListener((snapshot) => {
      setMetrics(snapshot.metrics);
      
      // 采样内存并检测泄漏
      memoryLeakDetector.sample();
      const leakResult = memoryLeakDetector.detectLeak(10);
      setLeakStatus(leakResult);
    });

    return () => {
      unsubscribe();
      performanceMonitor.stop();
    };
  }, []);

  // 按类别分组指标
  const groupedMetrics = metrics.reduce((groups, metric) => {
    if (!groups[metric.category]) {
      groups[metric.category] = [];
    }
    groups[metric.category].push(metric);
    return groups;
  }, {} as Record<string, PerformanceMetric[]>);

  const formatValue = (value: number, unit: string): string => {
    switch (unit) {
      case 'ms':
        return value < 1000 ? `${value.toFixed(1)}ms` : `${(value / 1000).toFixed(2)}s`;
      case 'mb':
        return `${value.toFixed(2)}MB`;
      case 'ops/s':
        return `${value.toFixed(1)} ops/s`;
      case '%':
        return `${value.toFixed(1)}%`;
      default:
        return value.toString();
    }
  };

  const getCategoryIcon = (category: string): string => {
    switch (category) {
      case 'render': return '🎨';
      case 'memory': return '💾';
      case 'network': return '🌐';
      case 'operation': return '⚙️';
      case 'system': return '💻';
      default: return '📊';
    }
  };

  const getTrendIcon = (trend: string): string => {
    switch (trend) {
      case 'increasing': return '📈';
      case 'decreasing': return '📉';
      case 'stable': return '➡️';
      default: return '❓';
    }
  };

  const getTrendColor = (trend: string): string => {
    switch (trend) {
      case 'increasing': return '#f87171'; // Red
      case 'decreasing': return '#4ade80'; // Green
      case 'stable': return '#60a5fa';     // Blue
      default: return '#9ca3af';
    }
  };

  return (
    <div className={`performance-dashboard ${collapsed ? 'collapsed' : ''}`}>
      {/* Header */}
      <div className="dashboard-header" onClick={onToggleCollapse}>
        <span className="icon">📊</span>
        <span className="title">性能监控</span>
        <span className="metric-count">{metrics.length} 指标</span>
        <span className="toggle-icon">{collapsed ? '▼' : '▲'}</span>
      </div>

      {!collapsed && (
        <div className="dashboard-content">
          {/* Memory Leak Detection */}
          <div className="leak-detection">
            <div className="leak-header">
              <span className="icon">🔍</span>
              <span className="label">内存泄漏检测</span>
              <span 
                className="trend"
                style={{ color: getTrendColor(leakStatus.trend) }}
              >
                {getTrendIcon(leakStatus.trend)} {leakStatus.trend}
              </span>
            </div>
            <div className="leak-details">
              <span>增长: {leakStatus.growthMB >= 0 ? '+' : ''}{leakStatus.growthMB.toFixed(2)}MB</span>
              {leakStatus.hasLeak && (
                <span className="warning">⚠️ 检测到潜在内存泄漏</span>
              )}
            </div>
          </div>

          {/* Metrics by Category */}
          {Object.entries(groupedMetrics).map(([category, categoryMetrics]) => (
            <div key={category} className="metric-category">
              <div className="category-header">
                <span className="icon">{getCategoryIcon(category)}</span>
                <span className="name">{category.toUpperCase()}</span>
                <span className="count">{categoryMetrics.length}</span>
              </div>
              
              <div className="metric-list">
                {categoryMetrics.map((metric, index) => (
                  <div key={`${metric.name}-${index}`} className="metric-item">
                    <div className="metric-info">
                      <span className="metric-name">{metric.name}</span>
                      <span className="metric-value" style={{ color: getValueColor(metric) }}>
                        {formatValue(metric.value, metric.unit)}
                      </span>
                    </div>
                    <div className="metric-bar">
                      <div 
                        className="bar-fill"
                        style={{
                          width: `${Math.min(getBarPercentage(metric), 100)}%`,
                          backgroundColor: getBarColor(metric),
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Footer Stats */}
          <div className="dashboard-footer">
            <span className="timestamp">
              更新于: {new Date().toLocaleTimeString()}
            </span>
            <button 
              className="clear-btn"
              onClick={() => {
                performanceMonitor.clearHistory();
                memoryLeakDetector.clear();
              }}
            >
              清除历史
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

function getValueColor(metric: PerformanceMetric): string {
  const { name, value, unit } = metric;

  // 内存相关 - 超过100MB警告
  if (unit === 'mb') {
    if (value > 200) return '#f87171'; // Red
    if (value > 100) return '#fbbf24'; // Yellow
    return '#4ade80'; // Green
  }

  // 时间相关 - 超过1秒警告
  if (unit === 'ms') {
    if (value > 5000) return '#f87171'; // Red
    if (value > 1000) return '#fbbf24'; // Yellow
    return '#4ade80'; // Green
  }

  return '#e0e0e0'; // Default
}

function getBarColor(metric: PerformanceMetric): string {
  const { value, unit } = metric;

  if (unit === 'mb') {
    if (value > 200) return '#f87171';
    if (value > 100) return '#fbbf24';
    return '#4ade80';
  }

  if (unit === 'ms') {
    if (value > 5000) return '#f87171';
    if (value > 1000) return '#fbbf24';
    return '#4ade80';
  }

  return '#60a5fa';
}

function getBarPercentage(metric: PerformanceMetric): number {
  const { value, unit } = metric;

  // 根据不同单位计算百分比
  if (unit === 'mb') {
    return (value / 500) * 100; // 假设最大500MB
  }

  if (unit === 'ms') {
    return (value / 10000) * 100; // 假设最大10秒
  }

  return Math.min(value, 100);
}
