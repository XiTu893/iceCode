import React, { useState } from 'react';

export type ToolCallType = 
  | 'Read'
  | 'Write'
  | 'Bash'
  | 'Glob'
  | 'Grep'
  | 'WebFetch'
  | 'TodoWrite'
  | 'Skill';

export interface ToolCall {
  id: string;
  tool: ToolCallType;
  status: 'pending' | 'running' | 'completed' | 'failed';
  timestamp: number;
  duration?: number; // 毫秒
  input: Record<string, any>;
  output?: any;
  error?: string;
}

interface ToolCallTrackerProps {
  calls: ToolCall[];
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  maxVisibleCalls?: number;
}

export const ToolCallTracker: React.FC<ToolCallTrackerProps> = ({
  calls,
  collapsed = false,
  onToggleCollapse,
  maxVisibleCalls = 8,
}) => {
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null);

  if (!calls || calls.length === 0) {
    return null;
  }

  const visibleCalls = calls.slice(-maxVisibleCalls);
  const hasMore = calls.length > maxVisibleCalls;

  return (
    <div className={`tool-call-tracker ${collapsed ? 'collapsed' : ''}`}>
      {/* 标题栏 */}
      {onToggleCollapse && (
        <div className="tracker-header" onClick={onToggleCollapse}>
          <span className="title">🔧 工具调用</span>
          <span className="call-count">({calls.length}次)</span>
          <span className="toggle-icon">{collapsed ? '▼' : '▲'}</span>
        </div>
      )}

      {/* 内容区域 */}
      {!collapsed && (
        <div className="tracker-content">
          <div className="calls-list">
            {visibleCalls.map((call) => (
              <ToolCallItem
                key={call.id}
                call={call}
                isExpanded={expandedCallId === call.id}
                onToggle={() => setExpandedCallId(
                  expandedCallId === call.id ? null : call.id
                )}
              />
            ))}
          </div>

          {hasMore && (
            <div className="more-indicator">
              还有 {calls.length - maxVisibleCalls} 次调用未显示
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * 单个工具调用项
 */
interface ToolCallItemProps {
  call: ToolCall;
  isExpanded: boolean;
  onToggle: () => void;
}

const ToolCallItem: React.FC<ToolCallItemProps> = ({
  call,
  isExpanded,
  onToggle,
}) => {
  const icon = getToolIcon(call.tool);
  const statusClass = `status-${call.status}`;
  const durationStr = call.duration ? formatDuration(call.duration) : null;

  return (
    <div className={`tool-call-item ${statusClass}`}>
      <div className="call-summary" onClick={onToggle}>
        <span className="tool-icon">{icon}</span>
        <span className="tool-name">{call.tool}</span>
        <span className="call-status">{getStatusText(call.status)}</span>
        {durationStr && <span className="call-duration">{durationStr}</span>}
        <span className="expand-icon">{isExpanded ? '−' : '+'}</span>
      </div>

      {/* 展开的详细信息 */}
      {isExpanded && (
        <div className="call-details">
          {/* 输入参数 */}
          <div className="detail-section">
            <div className="section-label">输入:</div>
            <pre className="code-block">{formatObject(call.input)}</pre>
          </div>

          {/* 输出结果 */}
          {call.output && (
            <div className="detail-section">
              <div className="section-label">输出:</div>
              <pre className="code-block">{formatOutput(call.output)}</pre>
            </div>
          )}

          {/* 错误信息 */}
          {call.error && (
            <div className="detail-section error">
              <div className="section-label">错误:</div>
              <div className="error-message">{call.error}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * 获取工具图标
 */
function getToolIcon(tool: ToolCallType): string {
  const icons: Record<ToolCallType, string> = {
    Read: '📖',
    Write: '✍️',
    Bash: '⚙️',
    Glob: '🔍',
    Grep: '🔎',
    WebFetch: '🌐',
    TodoWrite: '📝',
    Skill: '🎯',
  };
  return icons[tool] || '🔧';
}

/**
 * 获取状态文本
 */
function getStatusText(status: ToolCall['status']): string {
  const texts: Record<ToolCall['status'], string> = {
    pending: '等待中',
    running: '执行中',
    completed: '已完成',
    failed: '失败',
  };
  return texts[status];
}

/**
 * 格式化持续时间
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  } else {
    return `${(ms / 1000).toFixed(2)}s`;
  }
}

/**
 * 格式化对象为字符串
 */
function formatObject(obj: Record<string, any>): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

/**
 * 格式化输出（限制长度）
 */
function formatOutput(output: any): string {
  const str = typeof output === 'string' ? output : JSON.stringify(output, null, 2);
  
  // 限制显示长度
  const maxLength = 500;
  if (str.length > maxLength) {
    return str.substring(0, maxLength) + '\n... (输出过长，已截断)';
  }
  
  return str;
}

export default ToolCallTracker;
