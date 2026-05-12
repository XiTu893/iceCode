# Phase 5: Performance Optimization - Usage Guide

## Overview

Phase 5 implements comprehensive performance optimization features for IceCode IDE, including real-time monitoring, intelligent caching, and optimization utilities.

---

## Table of Contents

1. [Performance Monitoring](#performance-monitoring)
2. [Smart Caching](#smart-caching)
3. [Optimization Utilities](#optimization-utilities)
4. [Integration Examples](#integration-examples)
5. [Best Practices](#best-practices)

---

## Performance Monitoring

### PerformanceMonitor Service

Real-time performance metric collection and analysis.

#### Quick Start

```typescript
import { performanceMonitor } from '../services/performance/PerformanceMonitor.js';

// Start monitoring (collects metrics every 5 seconds by default)
performanceMonitor.start(5000);

// Stop monitoring
performanceMonitor.stop();

// Subscribe to performance snapshots
const unsubscribe = performanceMonitor.addListener((snapshot) => {
  console.log('Metrics:', snapshot.metrics);
  console.log('Timestamp:', snapshot.timestamp);
});

// Unsubscribe when done
unsubscribe();
```

#### Measuring Function Execution

```typescript
// Async function measurement
const result = await performanceMonitor.measure('api_call', async () => {
  const response = await fetch('/api/data');
  return response.json();
});

// Sync function measurement
const result = performanceMonitor.measureSync('data_processing', () => {
  return processData(largeDataset);
});
```

#### Custom Metrics

```typescript
performanceMonitor.recordMetric({
  name: 'custom_operation',
  value: 123.45,
  unit: 'ms',
  timestamp: Date.now(),
  category: 'operation',
});
```

#### Getting Statistics

```typescript
const stats = performanceMonitor.getMetricStats('api_call');
if (stats) {
  console.log('Min:', stats.min);
  console.log('Max:', stats.max);
  console.log('Average:', stats.avg);
  console.log('Count:', stats.count);
  console.log('Latest:', stats.latest);
}
```

#### Metric Categories

| Category | Description | Example Metrics |
|----------|-------------|-----------------|
| `render` | UI rendering times | Component mount, re-render |
| `memory` | Memory usage | Heap used, RSS |
| `network` | Network operations | API calls, WebSocket |
| `operation` | General operations | File I/O, search |
| `system` | System metrics | CPU, uptime |

---

## Smart Caching

### SmartCache Class

Multi-level caching with LRU eviction, TTL expiration, and size limits.

#### Quick Start

```typescript
import { SmartCache } from '../services/cache/SmartCache.js';

// Create a cache instance
const cache = new SmartCache({
  maxItems: 1000,      // Maximum items
  ttl: 5 * 60 * 1000,  // 5 minutes TTL
  maxSize: 50,         // 50MB max size
});

// Set a value
cache.set('user:123', userData);

// Get a value
const user = cache.get('user:123');

// Check if exists
if (cache.has('user:123')) {
  console.log('User cached');
}

// Delete a value
cache.delete('user:123');

// Clear all
cache.clear();
```

#### Get or Set Pattern

```typescript
// Automatic caching with factory function
const data = await cache.getOrSet('expensive_query', async () => {
  // This only runs if not in cache
  const result = await database.query('SELECT * FROM large_table');
  return result;
});
```

#### Pre-configured Caches

The system provides three ready-to-use cache instances:

```typescript
import { 
  fileContentCache,      // For file contents (30s TTL, 100MB)
  modelResponseCache,    // For AI responses (5min TTL, 50MB)
  searchResultCache,     // For search results (2min TTL, 30MB)
} from '../services/cache/SmartCache.js';

// Use directly
const content = await fileContentCache.getOrSet(filePath, () => readFile(filePath));
```

#### Cache Statistics

```typescript
const stats = cache.getStats();
console.log('Items:', stats.itemCount);
console.log('Size:', stats.totalSize / 1024 / 1024, 'MB');
console.log('Hit rate:', stats.hitRate);
console.log('Oldest item age:', Date.now() - stats.oldestItem, 'ms');
```

#### Event Listening

```typescript
const unsubscribe = cache.addListener((key, action) => {
  console.log(`Key "${key}" ${action}`);
  // Actions: 'set', 'get', 'delete', 'evict'
});
```

---

## Optimization Utilities

### Debounce

Delay execution until after a specified period of inactivity.

```typescript
import { debounce } from '../utils/performanceUtils.js';

// Create debounced function
const saveDraft = debounce(async (content: string) => {
  await api.saveDraft(content);
}, 1000); // Wait 1 second after last call

// Usage in input handler
<input onChange={(e) => saveDraft(e.target.value)} />
```

### Throttle

Limit execution to once per time interval.

```typescript
import { throttle } from '../utils/performanceUtils.js';

// Create throttled function
const handleScroll = throttle(() => {
  updateVirtualListPosition();
}, 100); // Execute at most once per 100ms

// Usage
window.addEventListener('scroll', handleScroll);
```

### BatchProcessor

Combine multiple operations into batches for efficiency.

```typescript
import { BatchProcessor } from '../utils/performanceUtils.js';

// Create batch processor
const processor = new BatchProcessor<{ path: string; content: string }>(
  async (batch) => {
    // Process batch of files
    await Promise.all(batch.map(file => saveFile(file.path, file.content)));
  },
  {
    batchSize: 10,   // Process when 10 items accumulated
    batchDelay: 200, // Or after 200ms
  }
);

// Add items
processor.add({ path: 'file1.ts', content: '...' });
processor.add({ path: 'file2.ts', content: '...' });

// Force flush
await processor.flush();

// Cleanup
processor.destroy();
```

### LazyLoader

Defer loading resources until first use.

```typescript
import { LazyLoader } from '../utils/performanceUtils.js';

// Create lazy loader
const heavyModule = new LazyLoader(async () => {
  console.log('Loading...');
  const module = await import('./heavy-module.js');
  return module;
});

// First call triggers loading
const mod = await heavyModule.get();

// Subsequent calls return cached value instantly
const mod2 = await heavyModule.get();

// Check if loaded
if (heavyModule.isLoaded()) {
  console.log('Already loaded');
}

// Reset cache
heavyModule.reset();
```

### Virtual List Calculator

Optimize long list rendering.

```typescript
import { calculateVirtualList } from '../utils/performanceUtils.js';

const config = {
  itemHeight: 40,
  containerHeight: 600,
  totalItems: 10000,
  overscan: 5,
};

const result = calculateVirtualList(config);
console.log('Render items', result.startIndex, 'to', result.endIndex);
console.log('Total height:', result.totalHeight);
```

### Memory Leak Detector

Detect potential memory leaks.

```typescript
import { memoryLeakDetector } from '../utils/performanceUtils.js';

// Record baseline at startup
memoryLeakDetector.recordBaseline();

// Periodically sample
setInterval(() => {
  memoryLeakDetector.sample();
  
  const result = memoryLeakDetector.detectLeak(10); // 10MB threshold
  if (result.hasLeak) {
    console.warn('Potential leak detected!');
    console.log('Growth:', result.growthMB, 'MB');
    console.log('Trend:', result.trend);
  }
}, 60000); // Every minute
```

---

## Integration Examples

### Performance Dashboard Component

Display real-time performance metrics in your UI:

```tsx
import { PerformanceDashboard } from '../components/PerformanceDashboard.js';

function App() {
  return (
    <div>
      <PerformanceDashboard collapsed={false} />
      {/* Rest of your app */}
    </div>
  );
}
```

### Complete Performance Optimizer Example

See `PerformanceOptimizerExample.tsx` for a comprehensive integration showing:
- Debounced search with caching
- Throttled scroll handling
- Batch file saving
- Lazy module loading
- Model response caching
- Real-time performance monitoring

---

## Best Practices

### 1. Caching Strategy

**When to cache:**
- Expensive computations (>100ms)
- Network requests (API calls)
- File I/O operations
- Model inference results
- Search results

**When NOT to cache:**
- Frequently changing data
- Security-sensitive information
- Small/fast operations (<10ms)
- One-time operations

### 2. TTL Configuration

| Data Type | Recommended TTL |
|-----------|----------------|
| File contents | 30 seconds |
| Search results | 2 minutes |
| Model responses | 5 minutes |
| User preferences | 1 hour |
| Static assets | 24 hours |

### 3. Cache Size Limits

Set appropriate limits based on available memory:

```typescript
// Conservative (low-memory systems)
const cache = new SmartCache({
  maxItems: 500,
  maxSize: 25, // 25MB
});

// Aggressive (high-memory systems)
const cache = new SmartCache({
  maxItems: 5000,
  maxSize: 200, // 200MB
});
```

### 4. Performance Monitoring

**What to monitor:**
- Operations taking >100ms
- Memory usage trends
- Cache hit rates
- Network request latency
- Render times for complex components

**Monitoring frequency:**
- Development: 1-2 seconds
- Production: 5-10 seconds
- Critical paths: On-demand measurement

### 5. Debounce vs Throttle

**Use debounce when:**
- Waiting for user to stop typing
- Auto-save functionality
- Window resize handling

**Use throttle when:**
- Scroll event handling
- Mouse move tracking
- Rate-limiting API calls

### 6. Batch Processing

**Optimal batch sizes:**
- File saves: 5-10 files
- API requests: 10-20 requests
- Database writes: 20-50 records

**Batch delays:**
- Interactive: 100-200ms
- Background: 500-1000ms

### 7. Memory Management

**Prevent leaks:**
- Always unsubscribe from listeners
- Clear caches periodically
- Use WeakMap for object associations
- Monitor heap growth trends

**Cleanup schedule:**
```typescript
// Daily cleanup
setInterval(() => {
  fileContentCache.cleanup();
  searchResultCache.cleanup();
  memoryLeakDetector.clear();
}, 24 * 60 * 60 * 1000);
```

---

## Troubleshooting

### High Memory Usage

**Symptoms:**
- Application slows down over time
- Heap size continuously growing

**Solutions:**
1. Check cache sizes and reduce limits
2. Enable memory leak detection
3. Review event listener cleanup
4. Implement periodic cache cleanup

### Poor Cache Hit Rate

**Symptoms:**
- Cache rarely used
- Frequent cache misses

**Solutions:**
1. Increase TTL duration
2. Increase cache size limits
3. Review cache key strategy
4. Check if data changes too frequently

### Slow Performance Measurements

**Symptoms:**
- Monitoring itself impacts performance

**Solutions:**
1. Increase monitoring interval (5-10s)
2. Reduce number of tracked metrics
3. Use on-demand measurement instead of continuous
4. Disable monitoring in production if needed

### Batch Processing Delays

**Symptoms:**
- Operations feel sluggish
- Visible lag in UI updates

**Solutions:**
1. Reduce batch delay (100-200ms)
2. Decrease batch size
3. Force flush on critical operations
4. Provide visual feedback during batching

---

## API Reference

### PerformanceMonitor

| Method | Description | Returns |
|--------|-------------|---------|
| `start(intervalMs?)` | Start monitoring | void |
| `stop()` | Stop monitoring | void |
| `recordMetric(metric)` | Record custom metric | void |
| `measure(name, fn)` | Measure async function | Promise<T> |
| `measureSync(name, fn)` | Measure sync function | T |
| `addListener(listener)` | Subscribe to snapshots | Unsubscribe fn |
| `getMetricStats(name)` | Get metric statistics | Stats or null |
| `getMetricNames()` | Get all metric names | string[] |
| `clearHistory()` | Clear all history | void |
| `getIsMonitoring()` | Check if monitoring | boolean |

### SmartCache

| Method | Description | Returns |
|--------|-------------|---------|
| `get(key)` | Get cached value | T or undefined |
| `set(key, value, size?)` | Set cached value | void |
| `delete(key)` | Delete cached value | boolean |
| `clear()` | Clear all cache | void |
| `has(key)` | Check if exists | boolean |
| `getOrSet(key, factory)` | Get or compute | T or Promise<T> |
| `cleanup()` | Remove expired items | number |
| `getStats()` | Get cache statistics | Stats object |
| `addListener(listener)` | Subscribe to events | Unsubscribe fn |

### Utility Functions

| Function | Description | Returns |
|----------|-------------|---------|
| `debounce(fn, delay)` | Create debounced function | Debounced fn |
| `throttle(fn, interval)` | Create throttled function | Throttled fn |

### Classes

| Class | Purpose | Key Methods |
|-------|---------|-------------|
| `BatchProcessor` | Batch operations | `add()`, `flush()`, `destroy()` |
| `LazyLoader` | Lazy resource loading | `get()`, `isLoaded()`, `reset()` |
| `MemoryLeakDetector` | Detect memory leaks | `sample()`, `detectLeak()`, `clear()` |

---

## Next Steps

With Phase 5 complete, all enhancement plan phases are now implemented:

✅ **Phase 1**: Task Status Management  
✅ **Phase 2**: System Resource Monitoring  
✅ **Phase 3**: Conversation Visualization  
✅ **Phase 4**: User Interaction Optimization  
✅ **Phase 5**: Performance Optimization  

See `IMPLEMENTATION_PROGRESS.md` for the complete project status and future roadmap.
