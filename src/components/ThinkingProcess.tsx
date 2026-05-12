import React, { useState } from 'react';

export type ThinkingStep = {
  id: string;
  type: 'analysis' | 'search' | 'read' | 'write' | 'execute' | 'plan' | 'complete';
  message: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  timestamp: number;
  details?: string;
  metadata?: Record<string, any>;
};

interface ThinkingProcessProps {
  steps: ThinkingStep[];
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  maxVisibleSteps?: number;
}

export const ThinkingProcess: React.FC<ThinkingProcessProps> = ({
  steps,
  collapsed = false,
  onToggleCollapse,
  maxVisibleSteps = 10,
}) => {
  const [expanded, setExpanded] = useState(false);

  if (!steps || steps.length === 0) {
    return null;
  }

  // 获取要显示的步骤（最近的N个）
  const visibleSteps = expanded ? steps : steps.slice(-maxVisibleSteps);
  const hasMore = steps.length > maxVisibleSteps;

  return (
    <div className={`thinking-process ${collapsed ? 'collapsed' : ''}`}>
      {/* 标题栏 */}
      {onToggleCollapse && (
        <div className="thinking-header" onClick={onToggleCollapse}>
          <span className="title">🤔 思考过程</span>
          <span className="step-count">({steps.length}步)</span>
          <span className="toggle-icon">{collapsed ? '▼' : '▲'}</span>
        </div>
      )}

      {/* 内容区域 */}
      {!collapsed && (
        <div className="thinking-content">
          <div className="steps-list">
            {visibleSteps.map((step, index) => (
              <ThinkingStepItem
                key={step.id}
                step={step}
                isLast={index === visibleSteps.length - 1}
                isFirstInVisible={index === 0 && !expanded}
              />
            ))}
          </div>

          {/* 展开/收起按钮 */}
          {hasMore && (
            <button
              className="expand-button"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? '收起' : `显示更多 (${steps.length - maxVisibleSteps}步)`}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * 单个思维步骤组件
 */
interface ThinkingStepItemProps {
  step: ThinkingStep;
  isLast: boolean;
  isFirstInVisible: boolean;
}

const ThinkingStepItem: React.FC<ThinkingStepItemProps> = ({
  step,
  isLast,
  isFirstInVisible,
}) => {
  const icon = getStepIcon(step.type);
  const statusClass = getStatusClass(step.status);
  const timeStr = formatTime(step.timestamp);

  return (
    <div className={`thinking-step ${statusClass} ${isLast ? 'last' : ''} ${isFirstInVisible ? 'first-visible' : ''}`}>
      {/* 连接线 */}
      {!isLast && <div className="step-connector" />}
      
      {/* 步骤内容 */}
      <div className="step-content">
        <div className="step-header">
          <span className="step-icon">{icon}</span>
          <span className="step-message">{step.message}</span>
          <span className="step-time">{timeStr}</span>
        </div>

        {/* 详细信息 */}
        {step.details && (
          <div className="step-details">
            {step.details}
          </div>
        )}

        {/* 元数据 */}
        {step.metadata && Object.keys(step.metadata).length > 0 && (
          <div className="step-metadata">
            {Object.entries(step.metadata).map(([key, value]) => (
              <span key={key} className="metadata-item">
                {key}: {String(value)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * 获取步骤图标
 */
function getStepIcon(type: ThinkingStep['type']): string {
  const icons: Record<ThinkingStep['type'], string> = {
    analysis: '🔍',
    search: '🔎',
    read: '📖',
    write: '✍️',
    execute: '⚙️',
    plan: '📋',
    complete: '✅',
  };
  return icons[type] || '💭';
}

/**
 * 获取状态样式类
 */
function getStatusClass(status: ThinkingStep['status']): string {
  return `status-${status}`;
}

/**
 * 格式化时间
 */
function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 1000) {
    return '刚刚';
  } else if (diff < 60000) {
    return `${Math.floor(diff / 1000)}秒前`;
  } else if (diff < 3600000) {
    return `${Math.floor(diff / 60000)}分钟前`;
  } else {
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }
}

export default ThinkingProcess;
