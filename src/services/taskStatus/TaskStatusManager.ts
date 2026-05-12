/**
 * 任务状态管理器
 * 
 * 负责追踪所有后台任务的生命周期，提供状态变更通知
 */

export type TaskType = 
  | 'code_generation'
  | 'file_operation'
  | 'test_execution'
  | 'command'
  | 'grpc_request'
  | 'model_inference';

export type TaskStatus = 
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface TaskStatusInfo {
  id: string;
  type: TaskType;
  status: TaskStatus;
  progress?: number; // 0-100
  startTime: number;
  endTime?: number;
  message?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export type TaskStatusListener = (task: TaskStatusInfo) => void;

export class TaskStatusManager {
  private tasks: Map<string, TaskStatusInfo> = new Map();
  private listeners: Set<TaskStatusListener> = new Set();

  /**
   * 创建新任务
   */
  createTask(id: string, type: TaskType, message?: string): TaskStatusInfo {
    const task: TaskStatusInfo = {
      id,
      type,
      status: 'pending',
      startTime: Date.now(),
      message,
    };

    this.tasks.set(id, task);
    this.notifyListeners(task);
    
    console.log(`[TaskStatus] Created task: ${id} (${type})`);
    return task;
  }

  /**
   * 更新任务状态为运行中
   */
  startTask(id: string, message?: string): TaskStatusInfo | null {
    const task = this.tasks.get(id);
    if (!task) {
      console.warn(`[TaskStatus] Task not found: ${id}`);
      return null;
    }

    task.status = 'running';
    task.message = message || task.message;
    this.tasks.set(id, task);
    this.notifyListeners(task);
    
    console.log(`[TaskStatus] Started task: ${id}`);
    return task;
  }

  /**
   * 更新任务进度
   */
  updateProgress(id: string, progress: number, message?: string): TaskStatusInfo | null {
    const task = this.tasks.get(id);
    if (!task) {
      console.warn(`[TaskStatus] Task not found: ${id}`);
      return null;
    }

    task.progress = Math.min(100, Math.max(0, progress));
    if (message) {
      task.message = message;
    }
    
    this.tasks.set(id, task);
    this.notifyListeners(task);
    
    return task;
  }

  /**
   * 标记任务完成
   */
  completeTask(id: string, message?: string): TaskStatusInfo | null {
    const task = this.tasks.get(id);
    if (!task) {
      console.warn(`[TaskStatus] Task not found: ${id}`);
      return null;
    }

    task.status = 'completed';
    task.progress = 100;
    task.endTime = Date.now();
    task.message = message || task.message;
    
    this.tasks.set(id, task);
    this.notifyListeners(task);
    
    console.log(`[TaskStatus] Completed task: ${id} (${this.getDuration(task)}ms)`);
    return task;
  }

  /**
   * 标记任务失败
   */
  failTask(id: string, error: string, message?: string): TaskStatusInfo | null {
    const task = this.tasks.get(id);
    if (!task) {
      console.warn(`[TaskStatus] Task not found: ${id}`);
      return null;
    }

    task.status = 'failed';
    task.error = error;
    task.endTime = Date.now();
    task.message = message || task.message;
    
    this.tasks.set(id, task);
    this.notifyListeners(task);
    
    console.error(`[TaskStatus] Failed task: ${id} - ${error}`);
    return task;
  }

  /**
   * 取消任务
   */
  cancelTask(id: string, message?: string): TaskStatusInfo | null {
    const task = this.tasks.get(id);
    if (!task) {
      console.warn(`[TaskStatus] Task not found: ${id}`);
      return null;
    }

    task.status = 'cancelled';
    task.endTime = Date.now();
    task.message = message || task.message;
    
    this.tasks.set(id, task);
    this.notifyListeners(task);
    
    console.log(`[TaskStatus] Cancelled task: ${id}`);
    return task;
  }

  /**
   * 获取任务状态
   */
  getTask(id: string): TaskStatusInfo | undefined {
    return this.tasks.get(id);
  }

  /**
   * 获取所有任务
   */
  getAllTasks(): TaskStatusInfo[] {
    return Array.from(this.tasks.values());
  }

  /**
   * 获取运行中的任务
   */
  getRunningTasks(): TaskStatusInfo[] {
    return this.getAllTasks().filter(t => t.status === 'running');
  }

  /**
   * 获取已完成的任务
   */
  getCompletedTasks(): TaskStatusInfo[] {
    return this.getAllTasks().filter(t => t.status === 'completed');
  }

  /**
   * 清理已完成的任务
   */
  cleanup(maxAge: number = 300000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, task] of this.tasks.entries()) {
      if (task.endTime && (now - task.endTime > maxAge)) {
        this.tasks.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[TaskStatus] Cleaned up ${cleaned} old tasks`);
    }

    return cleaned;
  }

  /**
   * 注册状态监听器
   */
  addListener(listener: TaskStatusListener): () => void {
    this.listeners.add(listener);
    
    // 返回取消订阅函数
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 移除监听器
   */
  removeListener(listener: TaskStatusListener): void {
    this.listeners.delete(listener);
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(task: TaskStatusInfo): void {
    this.listeners.forEach(listener => {
      try {
        listener(task);
      } catch (error) {
        console.error('[TaskStatus] Listener error:', error);
      }
    });
  }

  /**
   * 计算任务持续时间
   */
  private getDuration(task: TaskStatusInfo): number {
    const end = task.endTime || Date.now();
    return end - task.startTime;
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
  } {
    const tasks = this.getAllTasks();
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      running: tasks.filter(t => t.status === 'running').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length,
      cancelled: tasks.filter(t => t.status === 'cancelled').length,
    };
  }
}

// 导出单例实例
export const taskStatusManager = new TaskStatusManager();
