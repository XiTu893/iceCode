/**
 * IDE键盘快捷键管理系统
 * 
 * 统一管理所有键盘快捷键，支持自定义和冲突检测
 */

export type KeyModifier = 'ctrl' | 'shift' | 'alt' | 'meta';

export interface KeyBinding {
  id: string;
  keys: string[]; // 键序列，如 ['Ctrl', 'Shift', 'T']
  modifiers: KeyModifier[];
  key: string; // 主键
  description: string;
  category: 'navigation' | 'tasks' | 'monitoring' | 'editor' | 'system';
  enabled: boolean;
  handler?: () => void | Promise<void>;
}

export type KeyBindingListener = (binding: KeyBinding) => void;

export class KeyBindingManager {
  private bindings: Map<string, KeyBinding> = new Map();
  private listeners: Set<KeyBindingListener> = new Set();
  private enabled: boolean = true;

  /**
   * 注册快捷键
   */
  register(binding: KeyBinding): void {
    const id = this.generateBindingId(binding);
    
    if (this.bindings.has(id)) {
      console.warn(`[KeyBinding] Duplicate binding: ${id}`);
      return;
    }

    this.bindings.set(id, { ...binding, id });
    console.log(`[KeyBinding] Registered: ${this.formatBinding(binding)} - ${binding.description}`);
  }

  /**
   * 注销快捷键
   */
  unregister(id: string): void {
    this.bindings.delete(id);
    console.log(`[KeyBinding] Unregistered: ${id}`);
  }

  /**
   * 启用/禁用快捷键
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    console.log(`[KeyBinding] ${enabled ? 'Enabled' : 'Disabled'}`);
  }

  /**
   * 启用/禁用单个快捷键
   */
  toggleBinding(id: string, enabled: boolean): void {
    const binding = this.bindings.get(id);
    if (binding) {
      binding.enabled = enabled;
      console.log(`[KeyBinding] ${id}: ${enabled ? 'Enabled' : 'Disabled'}`);
    }
  }

  /**
   * 处理键盘事件
   */
  handleKeyEvent(event: KeyboardEvent): boolean {
    if (!this.enabled) {
      return false;
    }

    // 忽略在输入框中的按键（除非是特定快捷键）
    const target = event.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || 
                    target.tagName === 'TEXTAREA' || 
                    target.isContentEditable;

    // 查找匹配的快捷键
    for (const binding of this.bindings.values()) {
      if (!binding.enabled) continue;

      if (this.matchesBinding(event, binding, isInput)) {
        event.preventDefault();
        event.stopPropagation();

        // 执行处理函数
        if (binding.handler) {
          try {
            const result = binding.handler();
            if (result instanceof Promise) {
              result.catch(error => {
                console.error(`[KeyBinding] Handler error for ${binding.id}:`, error);
              });
            }
          } catch (error) {
            console.error(`[KeyBinding] Handler error for ${binding.id}:`, error);
          }
        }

        // 通知监听器
        this.notifyListeners(binding);

        return true;
      }
    }

    return false;
  }

  /**
   * 获取所有快捷键
   */
  getAllBindings(): KeyBinding[] {
    return Array.from(this.bindings.values());
  }

  /**
   * 按分类获取快捷键
   */
  getBindingsByCategory(category: KeyBinding['category']): KeyBinding[] {
    return this.getAllBindings().filter(b => b.category === category);
  }

  /**
   * 注册监听器
   */
  addListener(listener: KeyBindingListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * 移除监听器
   */
  removeListener(listener: KeyBindingListener): void {
    this.listeners.delete(listener);
  }

  /**
   * 检查是否匹配快捷键
   */
  private matchesBinding(
    event: KeyboardEvent, 
    binding: KeyBinding,
    isInput: boolean
  ): boolean {
    // 在输入框中只允许特定的系统级快捷键
    if (isInput && !binding.keys.includes('Escape')) {
      return false;
    }

    // 检查修饰键
    const hasCtrl = event.ctrlKey || event.metaKey;
    const hasShift = event.shiftKey;
    const hasAlt = event.altKey;

    if (binding.modifiers.includes('ctrl') && !hasCtrl) return false;
    if (binding.modifiers.includes('shift') && !hasShift) return false;
    if (binding.modifiers.includes('alt') && !hasAlt) return false;

    // 检查主键
    const eventKey = event.key.toLowerCase();
    const bindingKey = binding.key.toLowerCase();

    return eventKey === bindingKey;
  }

  /**
   * 生成快捷键ID
   */
  private generateBindingId(binding: KeyBinding): string {
    const modifiers = binding.modifiers.join('+');
    return `${modifiers}+${binding.key}`.toLowerCase();
  }

  /**
   * 格式化快捷键显示
   */
  private formatBinding(binding: KeyBinding): string {
    const platform = this.getPlatform();
    const modifiers = binding.modifiers.map(m => {
      if (platform === 'mac') {
        return m === 'ctrl' ? '⌃' : m === 'meta' ? '⌘' : m === 'alt' ? '⌥' : '⇧';
      }
      return m.charAt(0).toUpperCase() + m.slice(1);
    });

    return [...modifiers, binding.key].join('+');
  }

  /**
   * 获取平台信息
   */
  private getPlatform(): 'mac' | 'windows' | 'linux' {
    if (typeof navigator !== 'undefined') {
      if (navigator.platform.includes('Mac')) return 'mac';
      if (navigator.platform.includes('Win')) return 'windows';
    }
    return 'linux';
  }

  /**
   * 通知监听器
   */
  private notifyListeners(binding: KeyBinding): void {
    this.listeners.forEach(listener => {
      try {
        listener(binding);
      } catch (error) {
        console.error('[KeyBinding] Listener error:', error);
      }
    });
  }
}

// 导出单例实例
export const keyBindingManager = new KeyBindingManager();

/**
 * 注册默认快捷键
 */
export function registerDefaultKeyBindings(): void {
  const manager = keyBindingManager;

  // 导航类
  manager.register({
    id: 'navigate-tasks',
    keys: ['Ctrl', 'Shift', 'T'],
    modifiers: ['ctrl', 'shift'],
    key: 't',
    description: '切换任务面板',
    category: 'navigation',
    enabled: true,
  });

  manager.register({
    id: 'toggle-resource-monitor',
    keys: ['Ctrl', 'Shift', 'R'],
    modifiers: ['ctrl', 'shift'],
    key: 'r',
    description: '刷新资源监控',
    category: 'monitoring',
    enabled: true,
  });

  manager.register({
    id: 'open-notification-center',
    keys: ['Ctrl', 'Shift', 'N'],
    modifiers: ['ctrl', 'shift'],
    key: 'n',
    description: '打开通知中心',
    category: 'navigation',
    enabled: true,
  });

  // 任务类
  manager.register({
    id: 'cancel-task',
    keys: ['Escape'],
    modifiers: [],
    key: 'escape',
    description: '取消当前任务',
    category: 'tasks',
    enabled: true,
  });

  manager.register({
    id: 'retry-task',
    keys: ['Ctrl', 'R'],
    modifiers: ['ctrl'],
    key: 'r',
    description: '重试失败的任务',
    category: 'tasks',
    enabled: true,
  });

  // 编辑器类
  manager.register({
    id: 'focus-input',
    keys: ['Ctrl', 'L'],
    modifiers: ['ctrl'],
    key: 'l',
    description: '聚焦输入框',
    category: 'editor',
    enabled: true,
  });

  manager.register({
    id: 'clear-input',
    keys: ['Ctrl', 'K'],
    modifiers: ['ctrl'],
    key: 'k',
    description: '清空输入框',
    category: 'editor',
    enabled: true,
  });

  // 系统类
  manager.register({
    id: 'toggle-theme',
    keys: ['Ctrl', 'Shift', 'D'],
    modifiers: ['ctrl', 'shift'],
    key: 'd',
    description: '切换主题',
    category: 'system',
    enabled: true,
  });

  manager.register({
    id: 'show-help',
    keys: ['F1'],
    modifiers: [],
    key: 'f1',
    description: '显示帮助',
    category: 'system',
    enabled: true,
  });

  console.log('[KeyBinding] Default bindings registered');
}
