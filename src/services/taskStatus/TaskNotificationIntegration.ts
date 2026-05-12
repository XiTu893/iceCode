/**
 * 任务状态与通知集成服务
 * 
 * 监听任务状态变化并自动发送相应的桌面通知
 */

import { taskStatusManager, type TaskStatusInfo } from '../taskStatus/TaskStatusManager.js';
import { desktopNotificationService } from '../notifications/DesktopNotificationService.js';

export class TaskNotificationIntegration {
  private unsubscribe: (() => void) | null = null;

  /**
   * 启动集成服务
   */
  start(): void {
    console.log('[TaskNotification] Starting integration service...');

    // 监听任务状态变化
    this.unsubscribe = taskStatusManager.addListener((task) => {
      this.handleTaskStatusChange(task);
    });

    console.log('[TaskNotification] Integration service started');
  }

  /**
   * 停止集成服务
   */
  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
      console.log('[TaskNotification] Integration service stopped');
    }
  }

  /**
   * 处理任务状态变化
   */
  private handleTaskStatusChange(task: TaskStatusInfo): void {
    switch (task.status) {
      case 'completed':
        this.onTaskCompleted(task);
        break;
      case 'failed':
        this.onTaskFailed(task);
        break;
      case 'cancelled':
        this.onTaskCancelled(task);
        break;
      default:
        // 其他状态不发送通知
        break;
    }
  }

  /**
   * 任务完成处理
   */
  private onTaskCompleted(task: TaskStatusInfo): void {
    const duration = task.endTime ? task.endTime - task.startTime : 0;
    const durationStr = this.formatDuration(duration);

    let details = `耗时: ${durationStr}`;
    
    if (task.progress !== undefined) {
      details += ` | 进度: ${task.progress}%`;
    }

    if (task.metadata?.filesModified) {
      details += ` | 修改文件: ${task.metadata.filesModified}`;
    }

    desktopNotificationService.notifyTaskCompleted(
      this.getTaskDisplayName(task),
      details
    );
  }

  /**
   * 任务失败处理
   */
  private onTaskFailed(task: TaskStatusInfo): void {
    const errorMessage = task.error || '未知错误';
    desktopNotificationService.notifyTaskFailed(
      this.getTaskDisplayName(task),
      errorMessage
    );
  }

  /**
   * 任务取消处理
   */
  private onTaskCancelled(task: TaskStatusInfo): void {
    desktopNotificationService.notifyTaskCancelled(
      this.getTaskDisplayName(task)
    );
  }

  /**
   * 获取任务显示名称
   */
  private getTaskDisplayName(task: TaskStatusInfo): string {
    if (task.message) {
      return task.message;
    }

    // 根据任务类型生成默认名称
    const typeNames: Record<string, string> = {
      code_generation: '代码生成',
      file_operation: '文件操作',
      test_execution: '测试执行',
      command: '命令执行',
      grpc_request: 'gRPC请求',
      model_inference: '模型推理',
    };

    return typeNames[task.type] || task.type;
  }

  /**
   * 格式化持续时间
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    } else {
      const minutes = Math.floor(ms / 60000);
      const seconds = ((ms % 60000) / 1000).toFixed(0);
      return `${minutes}m ${seconds}s`;
    }
  }
}

// 导出单例实例
export const taskNotificationIntegration = new TaskNotificationIntegration();
