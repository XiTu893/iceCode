/**
 * IDE智能缓存服务
 * 
 * 提供多级缓存策略，包括内存缓存、LRU淘汰、TTL过期等
 */

export interface CacheOptions {
  maxItems?: number;        // 最大缓存项数
  ttl?: number;             // 生存时间（毫秒）
  maxSize?: number;         // 最大内存占用（MB）
}

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  size?: number;            // 估算大小（字节）
  accessCount: number;      // 访问次数
  lastAccessed: number;     // 最后访问时间
}

export type CacheListener = (key: string, action: 'set' | 'get' | 'delete' | 'evict') => void;

export class SmartCache<T = any> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private maxItems: number;
  private ttl: number;
  private maxSize: number;
  private currentSize: number = 0;
  private listeners: Set<CacheListener> = new Set();

  constructor(options: CacheOptions = {}) {
    this.maxItems = options.maxItems || 1000;
    this.ttl = options.ttl || 5 * 60 * 1000; // 默认5分钟
    this.maxSize = (options.maxSize || 50) * 1024 * 1024; // 默认50MB
  }

  /**
   * 获取缓存值
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    // 检查是否过期
    if (Date.now() - entry.timestamp > this.ttl) {
      this.delete(key);
      this.notify(key, 'evict');
      return undefined;
    }

    // 更新访问信息
    entry.accessCount++;
    entry.lastAccessed = Date.now();

    this.notify(key, 'get');
    return entry.value;
  }

  /**
   * 设置缓存值
   */
  set(key: string, value: T, size?: number): void {
    // 如果键已存在，先删除旧值
    if (this.cache.has(key)) {
      const oldEntry = this.cache.get(key)!;
      this.currentSize -= oldEntry.size || 0;
    }

    const entrySize = size || this.estimateSize(value);
    
    // 检查是否需要清理空间
    while (
      (this.cache.size >= this.maxItems || this.currentSize + entrySize > this.maxSize) &&
      this.cache.size > 0
    ) {
      this.evictLRU();
    }

    // 添加新条目
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      size: entrySize,
      accessCount: 0,
      lastAccessed: Date.now(),
    });

    this.currentSize += entrySize;
    this.notify(key, 'set');
  }

  /**
   * 删除缓存项
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (entry) {
      this.currentSize -= entry.size || 0;
      this.cache.delete(key);
      this.notify(key, 'delete');
      return true;
    }

    return false;
  }

  /**
   * 清除所有缓存
   */
  clear(): void {
    this.cache.clear();
    this.currentSize = 0;
  }

  /**
   * 检查键是否存在且有效
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    // 检查是否过期
    if (Date.now() - entry.timestamp > this.ttl) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 获取或设置（带工厂函数）
   */
  getOrSet(key: string, factory: () => T | Promise<T>): T | Promise<T> {
    const cached = this.get(key);
    
    if (cached !== undefined) {
      return cached;
    }

    const result = factory();
    
    if (result instanceof Promise) {
      return result.then(value => {
        this.set(key, value);
        return value;
      });
    } else {
      this.set(key, result);
      return result;
    }
  }

  /**
   * LRU淘汰策略
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      const entry = this.cache.get(oldestKey)!;
      this.currentSize -= entry.size || 0;
      this.cache.delete(oldestKey);
      this.notify(oldestKey, 'evict');
    }
  }

  /**
   * 估算值的大小
   */
  private estimateSize(value: any): number {
    try {
      const json = JSON.stringify(value);
      return Buffer.byteLength(json, 'utf8');
    } catch {
      return 1024; // 默认1KB
    }
  }

  /**
   * 清理过期项
   */
  cleanup(): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.currentSize -= entry.size || 0;
        this.cache.delete(key);
        this.notify(key, 'evict');
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): {
    itemCount: number;
    totalSize: number;
    hitRate: number;
    oldestItem: number;
    newestItem: number;
  } {
    let totalAccesses = 0;
    let oldestTimestamp = Infinity;
    let newestTimestamp = 0;

    for (const entry of this.cache.values()) {
      totalAccesses += entry.accessCount;
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
      }
      if (entry.timestamp > newestTimestamp) {
        newestTimestamp = entry.timestamp;
      }
    }

    return {
      itemCount: this.cache.size,
      totalSize: this.currentSize,
      hitRate: this.cache.size > 0 ? totalAccesses / this.cache.size : 0,
      oldestItem: oldestTimestamp === Infinity ? 0 : oldestTimestamp,
      newestItem: newestTimestamp,
    };
  }

  /**
   * 添加缓存事件监听器
   */
  addListener(listener: CacheListener): () => void {
    this.listeners.add(listener);
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 通知监听器
   */
  private notify(key: string, action: 'set' | 'get' | 'delete' | 'evict'): void {
    for (const listener of this.listeners) {
      try {
        listener(key, action);
      } catch (error) {
        console.error('[SmartCache] Listener error:', error);
      }
    }
  }
}

// 导出常用缓存实例
export const fileContentCache = new SmartCache<string>({
  maxItems: 500,
  ttl: 30 * 1000, // 30秒
  maxSize: 100,   // 100MB
});

export const modelResponseCache = new SmartCache<any>({
  maxItems: 200,
  ttl: 5 * 60 * 1000, // 5分钟
  maxSize: 50,        // 50MB
});

export const searchResultCache = new SmartCache<any[]>({
  maxItems: 100,
  ttl: 2 * 60 * 1000, // 2分钟
  maxSize: 30,        // 30MB
});
