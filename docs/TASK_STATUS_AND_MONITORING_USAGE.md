# 任务状态和资源监控服务使用指南

## 概述

本文档介绍如何使用新创建的任务状态管理系统和资源监控服务。

## 快速开始

### 1. 任务状态管理

#### 基本用法

```typescript
import { taskStatusManager } from '../services/taskStatus/TaskStatusManager.js';

// 创建任务
const task = taskStatusManager.createTask(
  'task-001',
  'code_generation',
  '生成用户登录组件'
);

// 开始任务
taskStatusManager.startTask('task-001');

// 更新进度
taskStatusManager.updateProgress('task-001', 50, '正在生成代码...');

// 完成任务
taskStatusManager.completeTask('task-001', '代码生成完成');

// 或者标记失败
taskStatusManager.failTask('task-001', '网络错误', '代码生成失败');
```

#### 监听任务状态

```typescript
import { taskStatusManager } from '../services/taskStatus/TaskStatusManager.js';

// 注册监听器
const unsubscribe = taskStatusManager.addListener((task) => {
  console.log(`Task ${task.id} status: ${task.status}`);
  
  if (task.status === 'completed') {
    console.log(`Completed in ${task.endTime! - task.startTime}ms`);
  }
});

// 取消监听
unsubscribe();
```

#### 查询任务

```typescript
// 获取单个任务
const task = taskStatusManager.getTask('task-001');

// 获取所有运行中的任务
const runningTasks = taskStatusManager.getRunningTasks();

// 获取统计信息
const stats = taskStatusManager.getStats();
console.log(stats);
// {
//   total: 10,
//   pending: 2,
//   running: 3,
//   completed: 4,
//   failed: 1,
//   cancelled: 0
// }
```

### 2. 桌面通知

#### 基本用法

```typescript
import { desktopNotificationService } from '../services/notifications/DesktopNotificationService.js';

// 发送普通通知
desktopNotificationService.send({
  title: '提示',
  body: '这是一个通知消息',
  type: 'info',
  timeout: 5000, // 5秒后自动关闭
});

// 发送任务完成通知
desktopNotificationService.notifyTaskCompleted(
  '代码生成',
  '耗时: 2.3s | 修改文件: 3个'
);

// 发送错误通知
desktopNotificationService.notifyTaskFailed(
  '测试执行',
  'AssertionError: expected 1 to equal 2'
);
```

#### 自定义通知

```typescript
desktopNotificationService.send({
  title: '重要提醒',
  body: '系统将在5分钟后重启',
  type: 'system_warning',
  urgency: 'critical',
  timeout: 0, // 不自动关闭
  onClick: () => {
    console.log('用户点击了通知');
  },
  onClose: () => {
    console.log('通知已关闭');
  },
});
```

#### 启用/禁用通知

```typescript
// 禁用通知（例如在勿扰模式下）
desktopNotificationService.setEnabled(false);

// 启用通知
desktopNotificationService.setEnabled(true);
```

### 3. 系统集成

#### 自动通知集成

```typescript
import { taskNotificationIntegration } from '../services/taskStatus/TaskNotificationIntegration.js';

// 启动集成服务（自动监听任务并发送通知）
taskNotificationIntegration.start();

// 停止集成服务
taskNotificationIntegration.stop();
```

启动后，所有任务的状态变化都会自动触发相应的桌面通知：
- 任务完成 → 成功通知
- 任务失败 → 错误通知
- 任务取消 → 取消通知

### 4. 系统资源监控

#### 基本用法

```typescript
import { systemMonitor } from '../services/monitoring/SystemMonitor.js';

// 启动监控（默认1秒更新一次）
systemMonitor.start();

// 自定义更新间隔（500毫秒）
systemMonitor.start(500);

// 获取当前统计数据
const stats = systemMonitor.getStats();
console.log(stats.cpu.usage); // CPU使用率
console.log(stats.memory.percentage); // 内存使用百分比
```

#### 监听资源变化

```typescript
import { systemMonitor } from '../services/monitoring/SystemMonitor.js';

// 注册监听器
const unsubscribe = systemMonitor.addListener((stats) => {
  console.log('CPU:', stats.cpu.usage + '%');
  console.log('内存:', stats.memory.percentage + '%');
  console.log('网络:', stats.network.connected ? '已连接' : '未连接');
});

// 取消监听
unsubscribe();
```

#### 停止监控

```typescript
systemMonitor.stop();
```

### 5. React组件使用

#### ResourceMonitor组件

```tsx
import { ResourceMonitor } from '../components/ResourceMonitor.js';
import '../components/ResourceMonitor.css';

function App() {
  return (
    <div>
      <h1>IceCode IDE</h1>
      
      {/* 资源监控面板 */}
      <ResourceMonitor 
        collapsed={false}
        onToggleCollapse={() => console.log('切换折叠状态')}
      />
    </div>
  );
}
```

## 实际应用场景

### 场景1：代码生成任务

```typescript
import { taskStatusManager } from '../services/taskStatus/TaskStatusManager.js';

async function generateCode(files: string[]) {
  const taskId = `codegen-${Date.now()}`;
  
  // 创建任务
  taskStatusManager.createTask(
    taskId,
    'code_generation',
    `生成 ${files.length} 个文件`
  );
  
  try {
    // 开始任务
    taskStatusManager.startTask(taskId);
    
    // 模拟代码生成过程
    for (let i = 0; i < files.length; i++) {
      const progress = ((i + 1) / files.length) * 100;
      taskStatusManager.updateProgress(
        taskId,
        progress,
        `正在生成 ${files[i]}...`
      );
      
      await generateFile(files[i]);
    }
    
    // 完成任务
    taskStatusManager.completeTask(taskId, `成功生成 ${files.length} 个文件`);
    
  } catch (error) {
    // 标记失败
    taskStatusManager.failTask(
      taskId,
      error.message,
      '代码生成失败'
    );
  }
}
```

### 场景2：gRPC请求监控

```typescript
import { taskStatusManager } from '../services/taskStatus/TaskStatusManager.js';

async function makeGrpcRequest(method: string, data: any) {
  const taskId = `grpc-${method}-${Date.now()}`;
  
  taskStatusManager.createTask(taskId, 'grpc_request', `调用 ${method}`);
  taskStatusManager.startTask(taskId);
  
  try {
    const response = await grpcClient.invoke(method, data);
    taskStatusManager.completeTask(taskId, `响应时间: ${response.latency}ms`);
    return response;
  } catch (error) {
    taskStatusManager.failTask(taskId, error.message);
    throw error;
  }
}
```

### 场景3：资源告警

```typescript
import { systemMonitor } from '../services/monitoring/SystemMonitor.js';
import { desktopNotificationService } from '../services/notifications/DesktopNotificationService.js';

// 监控资源使用并在超过阈值时告警
systemMonitor.addListener((stats) => {
  // CPU使用率过高
  if (stats.cpu.usage > 90) {
    desktopNotificationService.notifyWarning(
      'CPU使用率过高',
      `当前使用率: ${stats.cpu.usage.toFixed(1)}%`
    );
  }
  
  // 内存使用率过高
  if (stats.memory.percentage > 90) {
    desktopNotificationService.notifyWarning(
      '内存使用率过高',
      `当前使用率: ${stats.memory.percentage.toFixed(1)}%`
    );
  }
});
```

## API参考

### TaskStatusManager

| 方法 | 说明 | 参数 |
|------|------|------|
| `createTask(id, type, message)` | 创建任务 | id: string, type: TaskType, message?: string |
| `startTask(id, message)` | 开始任务 | id: string, message?: string |
| `updateProgress(id, progress, message)` | 更新进度 | id: string, progress: number, message?: string |
| `completeTask(id, message)` | 完成任务 | id: string, message?: string |
| `failTask(id, error, message)` | 标记失败 | id: string, error: string, message?: string |
| `cancelTask(id, message)` | 取消任务 | id: string, message?: string |
| `getTask(id)` | 获取任务 | id: string |
| `getAllTasks()` | 获取所有任务 | - |
| `getRunningTasks()` | 获取运行中的任务 | - |
| `addListener(listener)` | 注册监听器 | listener: TaskStatusListener |
| `cleanup(maxAge)` | 清理旧任务 | maxAge: number (默认5分钟) |

### DesktopNotificationService

| 方法 | 说明 | 参数 |
|------|------|------|
| `send(options)` | 发送通知 | options: NotificationOptions |
| `notifyTaskCompleted(name, details)` | 任务完成通知 | name: string, details?: string |
| `notifyTaskFailed(name, error)` | 任务失败通知 | name: string, error: string |
| `setEnabled(enabled)` | 启用/禁用通知 | enabled: boolean |

### SystemMonitor

| 方法 | 说明 | 参数 |
|------|------|------|
| `start(intervalMs)` | 启动监控 | intervalMs?: number (默认1000) |
| `stop()` | 停止监控 | - |
| `getStats()` | 获取统计数据 | - |
| `addListener(listener)` | 注册监听器 | listener: SystemStatsListener |

## 注意事项

1. **性能考虑**
   - 系统监控默认每秒更新一次，不建议设置过高的频率
   - 任务状态监听器应该轻量，避免阻塞主线程
   - 定期调用 `cleanup()` 清理已完成的任务

2. **通知频率限制**
   - 相同内容的通知有2秒冷却期，防止刷屏
   - 可以通过 `setCooldownPeriod()` 调整冷却时间

3. **跨平台兼容性**
   - Electron通知在所有平台都支持
   - 系统资源监控使用Node.js标准库，跨平台兼容

4. **内存管理**
   - 不再需要的监听器要及时取消订阅
   - 长时间运行的应用要定期清理任务记录

## 故障排查

### 问题1：通知不显示

**检查项：**
- 确认通知服务已启用：`desktopNotificationService.isEnabled()`
- 检查操作系统是否允许应用发送通知
- 查看控制台是否有错误日志

### 问题2：CPU使用率始终为0

**原因：**
第一次调用时会初始化基准值，返回0是正常的。第二次调用开始才会显示真实使用率。

### 问题3：任务状态不更新

**检查项：**
- 确认使用了正确的任务ID
- 检查监听器是否正确注册
- 查看任务是否存在：`taskStatusManager.getTask(id)`

## 下一步

- 查看完整实现代码
- 阅读Electron Notification API文档
- 探索更多系统监控选项（如磁盘I/O）
