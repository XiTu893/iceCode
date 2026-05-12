/**
 * 对话过程可视化集成示例
 * 
 * 展示如何将思维链、工具调用追踪和时间估算整合到实际应用中
 */

import React, { useState, useEffect } from 'react';
import { ThinkingProcess, type ThinkingStep } from '../components/ThinkingProcess.js';
import { ToolCallTracker, type ToolCall } from '../components/ToolCallTracker.js';
import { executionTimeEstimator } from '../utils/executionTimeEstimator.js';
import { taskStatusManager } from '../services/taskStatus/TaskStatusManager.js';

import '../components/ThinkingProcess.css';
import '../components/ToolCallTracker.css';

interface ConversationVisualizerProps {
  conversationId: string;
}

export const ConversationVisualizer: React.FC<ConversationVisualizerProps> = ({
  conversationId,
}) => {
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [timeEstimate, setTimeEstimate] = useState<{ remaining: number; progress: number } | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);

  // 模拟AI处理流程
  useEffect(() => {
    simulateAIProcessing();
  }, [conversationId]);

  /**
   * 模拟AI处理流程
   */
  const simulateAIProcessing = async () => {
    const newTaskId = `conv-${conversationId}-${Date.now()}`;
    setTaskId(newTaskId);

    // 创建任务
    taskStatusManager.createTask(
      newTaskId,
      'model_inference',
      '处理用户请求'
    );

    taskStatusManager.startTask(newTaskId);

    const startTime = Date.now();

    // 步骤1: 分析用户需求
    addThinkingStep('analysis', '分析用户需求', '正在理解用户的意图和上下文');
    await sleep(500);

    // 步骤2: 搜索相关文件
    addThinkingStep('search', '搜索相关文件', '查找与任务相关的代码文件');
    await sleep(300);

    const files = ['src/utils/helper.ts', 'src/components/App.tsx'];
    updateThinkingStepMetadata('search', { filesFound: files.length });

    // 工具调用1: Glob搜索
    addToolCall('Glob', { pattern: '**/*.ts' }, { files });
    await sleep(400);

    // 步骤3: 读取文件
    for (const file of files) {
      addThinkingStep('read', `读取 ${file}`, `正在加载文件内容`);
      
      // 工具调用2: Read
      addToolCall('Read', { path: file }, { content: '// 文件内容...' });
      await sleep(600);
      
      completeThinkingStep('read');
    }

    // 步骤4: 生成代码
    addThinkingStep('plan', '生成修改方案', '规划代码修改策略');
    await sleep(400);

    addThinkingStep('write', '应用代码修改', '正在写入修改后的代码');
    
    // 工具调用3: Write
    addToolCall('Write', 
      { path: files[0], changes: '优化函数实现' },
      { linesChanged: 15 }
    );
    await sleep(800);

    completeThinkingStep('write');

    // 步骤5: 执行测试
    addThinkingStep('execute', '运行测试验证', '确保修改没有破坏现有功能');
    
    // 工具调用4: Bash
    addToolCall('Bash', { command: 'npm test' }, { exitCode: 0, output: 'All tests passed' });
    await sleep(1200);

    completeThinkingStep('execute');

    // 完成
    addThinkingStep('complete', '任务完成', '所有操作已成功执行');
    
    const endTime = Date.now();
    const duration = endTime - startTime;

    // 记录执行时间
    executionTimeEstimator.recordExecution('model_inference', duration, {
      filesProcessed: files.length,
      toolsUsed: 4,
    });

    // 完成任务
    taskStatusManager.completeTask(newTaskId, `处理完成，耗时${duration}ms`);

    // 更新时间估算
    const estimate = executionTimeEstimator.estimate('model_inference', duration);
    if (estimate) {
      setTimeEstimate({
        remaining: estimate.remainingTime,
        progress: estimate.progress,
      });
    }
  };

  /**
   * 添加思维步骤
   */
  const addThinkingStep = (
    type: ThinkingStep['type'],
    message: string,
    details?: string
  ) => {
    const step: ThinkingStep = {
      id: `step-${Date.now()}-${Math.random()}`,
      type,
      message,
      status: 'running',
      timestamp: Date.now(),
      details,
    };

    setThinkingSteps(prev => [...prev, step]);
  };

  /**
   * 更新思维步骤元数据
   */
  const updateThinkingStepMetadata = (type: ThinkingStep['type'], metadata: Record<string, any>) => {
    setThinkingSteps(prev => {
      const updated = [...prev];
      const lastStepOfType = updated.findLast(s => s.type === type);
      if (lastStepOfType) {
        lastStepOfType.metadata = metadata;
      }
      return updated;
    });
  };

  /**
   * 完成思维步骤
   */
  const completeThinkingStep = (type: ThinkingStep['type']) => {
    setThinkingSteps(prev => {
      const updated = [...prev];
      const lastStepOfType = updated.findLast(s => s.type === type && s.status === 'running');
      if (lastStepOfType) {
        lastStepOfType.status = 'completed';
      }
      return updated;
    });
  };

  /**
   * 添加工具调用
   */
  const addToolCall = (
    tool: ToolCall['tool'],
    input: Record<string, any>,
    output?: any
  ) => {
    const call: ToolCall = {
      id: `call-${Date.now()}-${Math.random()}`,
      tool,
      status: 'completed',
      timestamp: Date.now(),
      duration: Math.random() * 1000 + 200, // 模拟200-1200ms
      input,
      output,
    };

    setToolCalls(prev => [...prev, call]);
  };

  /**
   * 睡眠辅助函数
   */
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  return (
    <div className="conversation-visualizer">
      {/* 时间估算 */}
      {timeEstimate && (
        <div className="time-estimate">
          <span>进度: {timeEstimate.progress.toFixed(0)}%</span>
          <span>预计剩余: {ExecutionTimeEstimator.formatRemainingTime(timeEstimate.remaining)}</span>
        </div>
      )}

      {/* 思维过程 */}
      <ThinkingProcess
        steps={thinkingSteps}
        collapsed={false}
        maxVisibleSteps={8}
      />

      {/* 工具调用 */}
      <ToolCallTracker
        calls={toolCalls}
        collapsed={false}
        maxVisibleCalls={6}
      />
    </div>
  );
};

export default ConversationVisualizer;
