/**
 * 性能优化集成示例
 * 
 * 展示如何在实际应用中整合性能监控、缓存和优化工具
 */

import React, { useState, useEffect } from 'react';
import { performanceMonitor } from '../services/performance/PerformanceMonitor.js';
import { fileContentCache, modelResponseCache, searchResultCache } from '../services/cache/SmartCache.js';
import { debounce, throttle, BatchProcessor, LazyLoader } from '../utils/performanceUtils.js';
import { PerformanceDashboard } from '../components/PerformanceDashboard.js';

import '../components/PerformanceDashboard.css';

interface PerformanceOptimizerExampleProps {
  workspacePath: string;
}

export const PerformanceOptimizerExample: React.FC<PerformanceOptimizerExampleProps> = ({
  workspacePath,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 示例1: 使用防抖处理搜索输入
  const debouncedSearch = debounce(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsLoading(true);
    
    try {
      // 尝试从缓存获取
      const cached = searchResultCache.get(query);
      if (cached) {
        console.log('[Search] Cache hit for:', query);
        setSearchResults(cached);
        return;
      }

      // 模拟搜索操作（带性能测量）
      const results = await performanceMonitor.measure(
        'file_search',
        () => simulateFileSearch(query)
      );

      // 缓存结果
      searchResultCache.set(query, results);
      setSearchResults(results);
    } catch (error) {
      console.error('[Search] Error:', error);
    } finally {
      setIsLoading(false);
    }
  }, 300);

  // 示例2: 使用节流处理滚动事件
  const handleScroll = throttle(() => {
    console.log('[Scroll] Position updated');
    // 更新虚拟列表位置等
  }, 100);

  // 示例3: 批量处理文件保存
  const [batchProcessor] = useState(() => 
    new BatchProcessor<{ path: string; content: string }>(
      async (batch) => {
        console.log(`[Batch] Saving ${batch.length} files`);
        
        await performanceMonitor.measure(
          'batch_save',
          () => Promise.all(batch.map(item => saveFile(item.path, item.content)))
        );
      },
      { batchSize: 5, batchDelay: 200 }
    )
  );

  // 示例4: 懒加载大型模块
  const [codeAnalyzer] = useState(() =>
    new LazyLoader(async () => {
      console.log('[LazyLoader] Loading code analyzer...');
      // 模拟加载重型模块
      await new Promise(resolve => setTimeout(resolve, 1000));
      return {
        analyze: (code: string) => {
          console.log('[CodeAnalyzer] Analyzing code');
          return { complexity: Math.random() * 10 };
        },
      };
    })
  );

  // 示例5: 使用缓存加速模型响应
  const getModelResponse = async (prompt: string) => {
    return modelResponseCache.getOrSet(
      `model:${prompt}`,
      async () => {
        console.log('[Model] Fetching response for:', prompt);
        
        const response = await performanceMonitor.measure(
          'model_inference',
          () => simulateModelInference(prompt)
        );

        return response;
      }
    );
  };

  // 示例6: 文件内容缓存
  const readFileWithCache = async (filePath: string) => {
    return fileContentCache.getOrSet(
      filePath,
      async () => {
        console.log('[File] Reading from disk:', filePath);
        
        const content = await performanceMonitor.measure(
          'file_read',
          () => simulateFileRead(filePath)
        );

        return content;
      }
    );
  };

  // 处理搜索输入变化
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    debouncedSearch(query);
  };

  // 批量添加文件到保存队列
  const queueFileSave = (path: string, content: string) => {
    batchProcessor.add({ path, content });
  };

  // 分析代码（首次调用时加载分析器）
  const analyzeCode = async (code: string) => {
    const analyzer = await codeAnalyzer.get();
    return analyzer.analyze(code);
  };

  return (
    <div className="performance-optimizer">
      <h2>性能优化示例</h2>

      {/* 性能监控面板 */}
      <PerformanceDashboard />

      {/* 搜索框（带防抖） */}
      <div className="search-section">
        <label>搜索文件:</label>
        <input
          type="text"
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="输入搜索关键词..."
        />
        {isLoading && <span className="loading">搜索中...</span>}
      </div>

      {/* 搜索结果 */}
      {searchResults.length > 0 && (
        <div className="results-section">
          <h3>搜索结果 ({searchResults.length})</h3>
          <ul>
            {searchResults.map((result, index) => (
              <li key={index}>
                {result.path} - {result.matches} matches
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 缓存统计 */}
      <div className="cache-stats">
        <h3>缓存统计</h3>
        <div className="stat-item">
          <strong>文件缓存:</strong> {fileContentCache.getStats().itemCount} 项, 
          {(fileContentCache.getStats().totalSize / 1024 / 1024).toFixed(2)}MB
        </div>
        <div className="stat-item">
          <strong>模型缓存:</strong> {modelResponseCache.getStats().itemCount} 项,
          {(modelResponseCache.getStats().totalSize / 1024 / 1024).toFixed(2)}MB
        </div>
        <div className="stat-item">
          <strong>搜索缓存:</strong> {searchResultCache.getStats().itemCount} 项,
          {(searchResultCache.getStats().totalSize / 1024 / 1024).toFixed(2)}MB
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="actions">
        <button onClick={() => batchProcessor.flush()}>
          立即保存所有文件
        </button>
        <button onClick={() => {
          fileContentCache.clear();
          modelResponseCache.clear();
          searchResultCache.clear();
        }}>
          清除所有缓存
        </button>
        <button onClick={async () => {
          const result = await analyzeCode('const x = 1 + 2;');
          console.log('Analysis result:', result);
        }}>
          分析代码（懒加载）
        </button>
      </div>
    </div>
  );
};

// 模拟函数
async function simulateFileSearch(query: string): Promise<any[]> {
  await new Promise(resolve => setTimeout(resolve, 500));
  return Array.from({ length: 5 }, (_, i) => ({
    path: `/path/to/file${i}.ts`,
    matches: Math.floor(Math.random() * 10),
  }));
}

async function simulateModelInference(prompt: string): Promise<any> {
  await new Promise(resolve => setTimeout(resolve, 1000));
  return {
    response: `Response to: ${prompt}`,
    tokens: Math.floor(Math.random() * 1000),
  };
}

async function simulateFileRead(filePath: string): Promise<string> {
  await new Promise(resolve => setTimeout(resolve, 200));
  return `Content of ${filePath}`;
}

async function saveFile(path: string, content: string): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 100));
  console.log(`Saved: ${path}`);
}
