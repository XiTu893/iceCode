/**
 * IDE性能监控服务
 * 
 * 实时监控应用性能指标，包括渲染时间、内存使用、操作延迟等
 */

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'mb' | 'ops/s' | '%';
  timestamp: number;
  category: 'render' | 'memory' | 'network' | 'operation' | 'system';
}

export interface PerformanceSnapshot {
  metrics: PerformanceMetric[];
  timestamp: number;
  duration: number; // 采样时长（毫秒）
}

export type PerformanceListener = (snapshot: PerformanceSnapshot) => void;

export class PerformanceMonitor {
  private listeners: Set<PerformanceListener> = new Set();
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private isMonitoring: boolean = false;
  private intervalId?: NodeJS.Timeout;
  private maxHistoryPerMetric: number = 100; // 每个指标最多保留100个历史值

  /**
   * 开始性能监控
   */
  start(intervalMs: number = 5000): void {
    if (this.isMonitoring) {
      console.warn('[PerformanceMonitor] Already monitoring');
      return;
    }

    this.isMonitoring = true;
    this.intervalId = setInterval(() => {
      this.collectMetrics();
    }, intervalMs);

    console.log('[PerformanceMonitor] Started monitoring');
  }

  /**
   * 停止性能监控
   */
  stop(): void {
    if (!this.isMonitoring) {
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    this.isMonitoring = false;
    console.log('[PerformanceMonitor] Stopped monitoring');
  }

  /**
   * 记录自定义性能指标
   */
  recordMetric(metric: PerformanceMetric): void {
    const history = this.metrics.get(metric.name) || [];
    history.push(metric);

    // 限制历史记录数量
    if (history.length > this.maxHistoryPerMetric) {
      history.shift();
    }

    this.metrics.set(metric.name, history);
  }

  /**
   * 测量函数执行时间
   */
  async measure<T>(name: string, fn: () => Promise<T> | T): Promise<T> {
    const startTime = performance.now();
    
    try {
      const result = await fn();
      const endTime = performance.now();
      const duration = endTime - startTime;

      this.recordMetric({
        name,
        value: duration,
        unit: 'ms',
        timestamp: Date.now(),
        category: 'operation',
      });

      return result;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;

      this.recordMetric({
        name: `${name}_error`,
        value: duration,
        unit: 'ms',
        timestamp: Date.now(),
        category: 'operation',
      });

      throw error;
    }
  }

  /**
   * 测量同步函数执行时间
   */
  measureSync<T>(name: string, fn: () => T): T {
    const startTime = performance.now();
    
    try {
      const result = fn();
      const endTime = performance.now();
      const duration = endTime - startTime;

      this.recordMetric({
        name,
        value: duration,
        unit: 'ms',
        timestamp: Date.now(),
        category: 'operation',
      });

      return result;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;

      this.recordMetric({
        name: `${name}_error`,
        value: duration,
        unit: 'ms',
        timestamp: Date.now(),
        category: 'operation',
      });

      throw error;
    }
  }

  /**
   * 收集当前性能快照
   */
  private collectMetrics(): void {
    const snapshot: PerformanceSnapshot = {
      metrics: [],
      timestamp: Date.now(),
      duration: 5000,
    };

    // 收集所有指标的最新值
    for (const [name, history] of this.metrics.entries()) {
      if (history.length > 0) {
        snapshot.metrics.push(history[history.length - 1]);
      }
    }

    // 添加系统指标
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memUsage = process.memoryUsage();
      
      snapshot.metrics.push({
        name: 'heap_used',
        value: memUsage.heapUsed / (1024 * 1024), // MB
        unit: 'mb',
        timestamp: Date.now(),
        category: 'memory',
      });

      snapshot.metrics.push({
        name: 'heap_total',
        value: memUsage.heapTotal / (1024 * 1024), // MB
        unit: 'mb',
        timestamp: Date.now(),
        category: 'memory',
      });

      snapshot.metrics.push({
        name: 'rss',
        value: memUsage.rss / (1024 * 1024), // MB
        unit: 'mb',
        timestamp: Date.now(),
        category: 'memory',
      });
    }

    // 通知监听器
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (error) {
        console.error('[PerformanceMonitor] Listener error:', error);
      }
    }
  }

  /**
   * 添加性能数据监听器
   */
  addListener(listener: PerformanceListener): () => void {
    this.listeners.add(listener);
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 获取指标统计信息
   */
  getMetricStats(metricName: string): {
    min: number;
    max: number;
    avg: number;
    count: number;
    latest: number;
  } | null {
    const history = this.metrics.get(metricName);
    
    if (!history || history.length === 0) {
      return null;
    }

    const values = history.map(m => m.value);
    const sum = values.reduce((acc, val) => acc + val, 0);

    return {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: sum / values.length,
      count: values.length,
      latest: values[values.length - 1],
    };
  }

  /**
   * 获取所有指标名称
   */
  getMetricNames(): string[] {
    return Array.from(this.metrics.keys());
  }

  /**
   * 清除历史记录
   */
  clearHistory(): void {
    this.metrics.clear();
  }

  /**
   * 检查是否正在监控
   */
  getIsMonitoring(): boolean {
    return this.isMonitoring;
  }
}

// 导出单例实例
export const performanceMonitor = new PerformanceMonitor();
