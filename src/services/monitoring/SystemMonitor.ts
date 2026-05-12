/**
 * 系统资源监控服务
 * 
 * 实时监控CPU、内存、网络等系统资源使用情况
 */

import os from 'os';

export interface MemoryUsage {
  used: number;      // 已使用字节数
  total: number;     // 总字节数
  percentage: number; // 使用百分比
}

export interface NetworkStatus {
  connected: boolean;
  latency?: number;  // 延迟（毫秒）
  interfaces: NetworkInterface[];
}

export interface NetworkInterface {
  name: string;
  ip: string;
  family: 'IPv4' | 'IPv6';
  internal: boolean;
}

export interface DiskUsage {
  free: number;      // 可用空间（字节）
  total: number;     // 总空间（字节）
  used: number;      // 已用空间（字节）
  percentage: number; // 使用百分比
}

export interface SystemStats {
  cpu: {
    usage: number;           // CPU使用率 0-100
    cores: number;           // 核心数
    model: string;           // CPU型号
    speed: number;           // 主频（MHz）
  };
  memory: MemoryUsage;
  network: NetworkStatus;
  uptime: number;            // 系统运行时间（秒）
  loadAverage: number[];     // 负载平均值 [1min, 5min, 15min]
}

export type SystemStatsListener = (stats: SystemStats) => void;

export class SystemMonitor {
  private listeners: Set<SystemStatsListener> = new Set();
  private intervalId: NodeJS.Timeout | null = null;
  private updateInterval: number = 1000; // 默认1秒更新一次
  private previousCpuInfo: { idle: number; total: number } | null = null;

  /**
   * 启动监控
   */
  start(intervalMs?: number): void {
    if (intervalMs) {
      this.updateInterval = intervalMs;
    }

    if (this.intervalId) {
      console.warn('[SystemMonitor] Already running');
      return;
    }

    console.log(`[SystemMonitor] Starting with ${this.updateInterval}ms interval`);
    
    // 立即获取一次数据
    this.emitStats();

    // 定时更新
    this.intervalId = setInterval(() => {
      this.emitStats();
    }, this.updateInterval);
  }

  /**
   * 停止监控
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[SystemMonitor] Stopped');
    }
  }

  /**
   * 注册监听器
   */
  addListener(listener: SystemStatsListener): () => void {
    this.listeners.add(listener);
    
    // 返回取消订阅函数
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 移除监听器
   */
  removeListener(listener: SystemStatsListener): void {
    this.listeners.delete(listener);
  }

  /**
   * 获取当前系统统计信息
   */
  getStats(): SystemStats {
    return {
      cpu: this.getCPUStats(),
      memory: this.getMemoryUsage(),
      network: this.getNetworkStatus(),
      uptime: os.uptime(),
      loadAverage: os.loadavg(),
    };
  }

  /**
   * 获取CPU统计信息
   */
  private getCPUStats(): SystemStats['cpu'] {
    const cpus = os.cpus();
    
    return {
      usage: this.calculateCPUUsage(),
      cores: cpus.length,
      model: cpus[0].model,
      speed: cpus[0].speed,
    };
  }

  /**
   * 计算CPU使用率
   */
  private calculateCPUUsage(): number {
    const cpus = os.cpus();
    
    let idle = 0;
    let total = 0;

    for (const cpu of cpus) {
      for (const type in cpu.times) {
        const time = cpu.times[type as keyof typeof cpu.times];
        total += time;
        if (type === 'idle') {
          idle += time;
        }
      }
    }

    // 如果是第一次调用，保存当前值并返回0
    if (!this.previousCpuInfo) {
      this.previousCpuInfo = { idle, total };
      return 0;
    }

    // 计算使用率
    const idleDiff = idle - this.previousCpuInfo.idle;
    const totalDiff = total - this.previousCpuInfo.total;
    
    this.previousCpuInfo = { idle, total };

    if (totalDiff === 0) {
      return 0;
    }

    const usage = (1 - idleDiff / totalDiff) * 100;
    return Math.round(usage * 100) / 100; // 保留两位小数
  }

  /**
   * 获取内存使用情况
   */
  getMemoryUsage(): MemoryUsage {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const percentage = (used / total) * 100;

    return {
      used,
      total,
      percentage: Math.round(percentage * 100) / 100,
    };
  }

  /**
   * 获取网络状态
   */
  getNetworkStatus(): NetworkStatus {
    const interfaces = os.networkInterfaces();
    const networkInterfaces: NetworkInterface[] = [];
    let hasActiveConnection = false;

    for (const [name, nets] of Object.entries(interfaces)) {
      if (!nets) continue;

      for (const net of nets) {
        // 跳过内部接口和未分配的地址
        if (net.internal || !net.address) continue;

        networkInterfaces.push({
          name,
          ip: net.address,
          family: net.family as 'IPv4' | 'IPv6',
          internal: net.internal,
        });

        // 如果有非本地IP，认为有网络连接
        if (!net.internal && net.address !== '127.0.0.1' && net.address !== '::1') {
          hasActiveConnection = true;
        }
      }
    }

    return {
      connected: hasActiveConnection,
      latency: undefined, // 需要ping测试才能获取
      interfaces: networkInterfaces,
    };
  }

  /**
   * 获取磁盘使用情况（简化版）
   */
  getDiskUsage(): DiskUsage {
    // Node.js标准库不直接提供磁盘使用情况
    // 这里返回一个占位实现
    // 实际项目中可以使用 systeminformation 库
    
    return {
      free: 0,
      total: 0,
      used: 0,
      percentage: 0,
    };
  }

  /**
   * 发送统计数据给所有监听器
   */
  private emitStats(): void {
    const stats = this.getStats();
    
    this.listeners.forEach(listener => {
      try {
        listener(stats);
      } catch (error) {
        console.error('[SystemMonitor] Listener error:', error);
      }
    });
  }

  /**
   * 格式化字节数为可读字符串
   */
  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }
}

// 导出单例实例
export const systemMonitor = new SystemMonitor();
