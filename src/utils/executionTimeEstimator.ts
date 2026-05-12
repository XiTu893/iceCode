/**
 * 执行时间估算器
 * 
 * 基于历史数据估算任务执行时间，提供进度预测
 */

export interface ExecutionRecord {
  taskId: string;
  taskType: string;
  startTime: number;
  endTime: number;
  duration: number;
  metadata?: Record<string, any>;
}

export interface TimeEstimate {
  estimatedDuration: number; // 预估总时长（毫秒）
  elapsedTime: number;       // 已用时长（毫秒）
  remainingTime: number;     // 剩余时长（毫秒）
  progress: number;          // 进度百分比 0-100
  confidence: number;        // 置信度 0-1
}

export class ExecutionTimeEstimator {
  private records: Map<string, ExecutionRecord[]> = new Map();
  private maxRecordsPerType: number = 50; // 每种类型最多保留的记录数

  /**
   * 记录任务执行完成
   */
  recordExecution(taskType: string, duration: number, metadata?: Record<string, any>): void {
    const taskId = `${taskType}-${Date.now()}`;
    const now = Date.now();
    
    const record: ExecutionRecord = {
      taskId,
      taskType,
      startTime: now - duration,
      endTime: now,
      duration,
      metadata,
    };

    // 获取或创建记录数组
    if (!this.records.has(taskType)) {
      this.records.set(taskType, []);
    }

    const typeRecords = this.records.get(taskType)!;
    typeRecords.push(record);

    // 限制记录数量
    if (typeRecords.length > this.maxRecordsPerType) {
      typeRecords.shift(); // 移除最旧的记录
    }

    console.log(`[TimeEstimator] Recorded ${taskType}: ${duration}ms`);
  }

  /**
   * 估算任务执行时间
   */
  estimate(taskType: string, elapsedTime: number, metadata?: Record<string, any>): TimeEstimate | null {
    const typeRecords = this.records.get(taskType);

    // 如果没有历史数据，返回null
    if (!typeRecords || typeRecords.length === 0) {
      return null;
    }

    // 计算平均执行时间
    const avgDuration = this.calculateAverageDuration(typeRecords, metadata);
    
    // 如果还没有开始计时，无法估算
    if (elapsedTime <= 0) {
      return {
        estimatedDuration: avgDuration,
        elapsedTime: 0,
        remainingTime: avgDuration,
        progress: 0,
        confidence: this.calculateConfidence(typeRecords.length),
      };
    }

    // 计算进度和剩余时间
    const progress = Math.min(100, (elapsedTime / avgDuration) * 100);
    const remainingTime = Math.max(0, avgDuration - elapsedTime);

    return {
      estimatedDuration: avgDuration,
      elapsedTime,
      remainingTime,
      progress,
      confidence: this.calculateConfidence(typeRecords.length),
    };
  }

  /**
   * 格式化剩余时间为可读字符串
   */
  static formatRemainingTime(ms: number): string {
    if (ms < 1000) {
      return '< 1秒';
    } else if (ms < 60000) {
      const seconds = Math.ceil(ms / 1000);
      return `约${seconds}秒`;
    } else if (ms < 3600000) {
      const minutes = Math.ceil(ms / 60000);
      return `约${minutes}分钟`;
    } else {
      const hours = Math.ceil(ms / 3600000);
      return `约${hours}小时`;
    }
  }

  /**
   * 获取统计信息
   */
  getStats(taskType: string): {
    count: number;
    average: number;
    min: number;
    max: number;
    median: number;
  } | null {
    const typeRecords = this.records.get(taskType);
    
    if (!typeRecords || typeRecords.length === 0) {
      return null;
    }

    const durations = typeRecords.map(r => r.duration).sort((a, b) => a - b);
    const sum = durations.reduce((acc, d) => acc + d, 0);
    
    return {
      count: durations.length,
      average: sum / durations.length,
      min: durations[0],
      max: durations[durations.length - 1],
      median: durations[Math.floor(durations.length / 2)],
    };
  }

  /**
   * 清除历史记录
   */
  clear(taskType?: string): void {
    if (taskType) {
      this.records.delete(taskType);
    } else {
      this.records.clear();
    }
  }

  /**
   * 计算平均执行时间（支持元数据过滤）
   */
  private calculateAverageDuration(
    records: ExecutionRecord[],
    metadata?: Record<string, any>
  ): number {
    let filteredRecords = records;

    // 如果提供了元数据，尝试匹配相似的记录
    if (metadata && Object.keys(metadata).length > 0) {
      filteredRecords = records.filter(record => {
        if (!record.metadata) return false;
        
        // 检查关键元数据字段是否匹配
        for (const [key, value] of Object.entries(metadata)) {
          if (record.metadata[key] !== value) {
            return false;
          }
        }
        return true;
      });

      // 如果没有匹配的记录，使用所有记录
      if (filteredRecords.length === 0) {
        filteredRecords = records;
      }
    }

    // 计算加权平均值（最近的记录权重更高）
    const totalWeight = filteredRecords.reduce((sum, _, index) => {
      return sum + (index + 1);
    }, 0);

    const weightedSum = filteredRecords.reduce((sum, record, index) => {
      const weight = index + 1; // 越新的记录权重越高
      return sum + record.duration * weight;
    }, 0);

    return weightedSum / totalWeight;
  }

  /**
   * 计算置信度（基于样本数量）
   */
  private calculateConfidence(sampleCount: number): number {
    // 样本越多，置信度越高
    // 1个样本: 0.3, 5个样本: 0.6, 10个样本: 0.8, 20+样本: 0.95
    if (sampleCount === 0) return 0;
    if (sampleCount === 1) return 0.3;
    if (sampleCount < 5) return 0.3 + (sampleCount - 1) * 0.075;
    if (sampleCount < 10) return 0.6 + (sampleCount - 5) * 0.04;
    if (sampleCount < 20) return 0.8 + (sampleCount - 10) * 0.015;
    return 0.95;
  }
}

// 导出单例实例
export const executionTimeEstimator = new ExecutionTimeEstimator();
