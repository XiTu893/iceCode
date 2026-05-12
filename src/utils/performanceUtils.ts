/**
 * 性能优化工具函数
 * 
 * 提供防抖、节流、懒加载等常见优化技术
 */

/**
 * 防抖函数 - 在指定延迟内只执行最后一次调用
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return function (this: any, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn.apply(this, args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * 节流函数 - 在指定时间间隔内最多执行一次
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  interval: number
): (...args: Parameters<T>) => void {
  let lastExecTime = 0;
  let timeoutId: NodeJS.Timeout | null = null;

  return function (this: any, ...args: Parameters<T>) {
    const now = Date.now();
    const remaining = interval - (now - lastExecTime);

    if (remaining <= 0) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      lastExecTime = now;
      fn.apply(this, args);
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => {
        lastExecTime = Date.now();
        timeoutId = null;
        fn.apply(this, args);
      }, remaining);
    }
  };
}

/**
 * 批量处理 - 将多个请求合并为一个批次处理
 */
export class BatchProcessor<T> {
  private items: T[] = [];
  private timer: NodeJS.Timeout | null = null;
  private processor: (items: T[]) => void | Promise<void>;
  private batchSize: number;
  private batchDelay: number;

  constructor(
    processor: (items: T[]) => void | Promise<void>,
    options: { batchSize?: number; batchDelay?: number } = {}
  ) {
    this.processor = processor;
    this.batchSize = options.batchSize || 10;
    this.batchDelay = options.batchDelay || 100;
  }

  /**
   * 添加项目到批处理队列
   */
  add(item: T): void {
    this.items.push(item);

    // 如果达到批次大小，立即处理
    if (this.items.length >= this.batchSize) {
      this.flush();
      return;
    }

    // 否则等待延迟后处理
    if (!this.timer) {
      this.timer = setTimeout(() => {
        this.flush();
      }, this.batchDelay);
    }
  }

  /**
   * 强制刷新批处理队列
   */
  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.items.length === 0) {
      return;
    }

    const batch = [...this.items];
    this.items = [];

    try {
      await this.processor(batch);
    } catch (error) {
      console.error('[BatchProcessor] Error processing batch:', error);
      // 失败时重新加入队列
      this.items.unshift(...batch);
    }
  }

  /**
   * 获取队列长度
   */
  getQueueLength(): number {
    return this.items.length;
  }

  /**
   * 销毁批处理器
   */
  destroy(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.items = [];
  }
}

/**
 * 懒加载包装器 - 延迟加载资源直到首次使用
 */
export class LazyLoader<T> {
  private factory: () => T | Promise<T>;
  private value: T | undefined;
  private promise: Promise<T> | undefined;
  private loading: boolean = false;

  constructor(factory: () => T | Promise<T>) {
    this.factory = factory;
  }

  /**
   * 获取值（首次调用时加载）
   */
  async get(): Promise<T> {
    if (this.value !== undefined) {
      return this.value;
    }

    if (this.promise) {
      return this.promise;
    }

    this.loading = true;
    this.promise = Promise.resolve(this.factory());

    try {
      this.value = await this.promise;
      return this.value;
    } finally {
      this.loading = false;
      this.promise = undefined;
    }
  }

  /**
   * 同步获取（如果已加载）
   */
  getSync(): T | undefined {
    return this.value;
  }

  /**
   * 检查是否已加载
   */
  isLoaded(): boolean {
    return this.value !== undefined;
  }

  /**
   * 重置缓存
   */
  reset(): void {
    this.value = undefined;
    this.promise = undefined;
    this.loading = false;
  }
}

/**
 * 虚拟列表计算器 - 用于长列表渲染优化
 */
export interface VirtualListConfig {
  itemHeight: number;
  containerHeight: number;
  totalItems: number;
  overscan?: number; // 额外渲染的项目数
}

export interface VirtualListResult {
  startIndex: number;
  endIndex: number;
  visibleItems: number;
  offsetY: number;
  totalHeight: number;
}

export function calculateVirtualList(config: VirtualListConfig): VirtualListResult {
  const {
    itemHeight,
    containerHeight,
    totalItems,
    overscan = 5,
  } = config;

  const totalHeight = totalItems * itemHeight;
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  
  // 计算可见范围（这里假设从顶部开始）
  const startIndex = 0;
  const endIndex = Math.min(startIndex + visibleCount + overscan * 2, totalItems);
  const offsetY = 0;

  return {
    startIndex,
    endIndex,
    visibleItems: endIndex - startIndex,
    offsetY,
    totalHeight,
  };
}

/**
 * 内存泄漏检测器
 */
export class MemoryLeakDetector {
  private baseline: number = 0;
  private samples: number[] = [];
  private maxSamples: number = 100;

  /**
   * 记录基线内存
   */
  recordBaseline(): void {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      this.baseline = process.memoryUsage().heapUsed;
    }
  }

  /**
   * 采样当前内存
   */
  sample(): void {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const current = process.memoryUsage().heapUsed;
      this.samples.push(current);

      if (this.samples.length > this.maxSamples) {
        this.samples.shift();
      }
    }
  }

  /**
   * 检测潜在内存泄漏
   */
  detectLeak(thresholdMB: number = 10): {
    hasLeak: boolean;
    growthMB: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  } {
    if (this.samples.length < 10) {
      return {
        hasLeak: false,
        growthMB: 0,
        trend: 'stable',
      };
    }

    const recent = this.samples.slice(-10);
    const older = this.samples.slice(0, 10);

    const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const olderAvg = older.reduce((sum, val) => sum + val, 0) / older.length;

    const growthMB = (recentAvg - olderAvg) / (1024 * 1024);

    // 判断趋势
    let trend: 'increasing' | 'decreasing' | 'stable';
    if (growthMB > 1) {
      trend = 'increasing';
    } else if (growthMB < -1) {
      trend = 'decreasing';
    } else {
      trend = 'stable';
    }

    return {
      hasLeak: growthMB > thresholdMB,
      growthMB,
      trend,
    };
  }

  /**
   * 清除样本
   */
  clear(): void {
    this.samples = [];
  }
}

// 导出单例实例
export const memoryLeakDetector = new MemoryLeakDetector();
