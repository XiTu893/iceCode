# Ice IDE - 自动后端管理功能

## ✅ 已实现功能

### 自动启动OpenClaude后端

当Ice IDE启动时，会自动启动OpenClaude gRPC后端服务：

1. **开发模式** (`NODE_ENV=development`)
   - 使用 `bun run scripts/start-grpc.ts` 启动
   - 支持TypeScript热重载

2. **生产模式** (打包后)
   - 使用 `node dist/scripts/start-grpc.js` 启动
   - 优化的JavaScript执行

### 自动停止服务

当IDE关闭时，会优雅地停止后端服务：

1. **正常退出** - 窗口关闭时触发
2. **强制退出** - 应用退出前清理
3. **macOS特殊处理** - 窗口关闭但应用保持运行时也停止服务

### 智能检测机制

- 监听stdout输出，检测服务启动成功
- 多种关键词匹配：`started`, `listening`, `gRPC server`, `50051`
- 30秒超时保护，避免无限等待

### 进程管理

```typescript
// 启动流程
app.whenReady() 
  → startOpenClaudeBackend()
  → spawn process
  → wait for startup signal
  → create window

// 停止流程  
window-all-closed / before-quit
  → stopOpenClaudeBackend()
  → kill SIGTERM
  → wait 5s
  → force kill SIGKILL if needed
  → app.quit()
```

## 🔧 技术细节

### 主进程代码位置

`ide/electron/main.ts`

关键函数：
- `startOpenClaudeBackend()` - 启动后端
- `stopOpenClaudeBackend()` - 停止后端
- `app.on('before-quit')` - 退出前清理
- `app.on('window-all-closed')` - 窗口关闭处理

### 环境变量

```bash
NODE_ENV=production
PORT=50051
```

### 跨平台兼容

- ✅ Windows (shell mode enabled)
- ✅ macOS (darwin special handling)
- ✅ Linux

## 📝 用户体验

### 之前（需要手动操作）

```
1. 安装IDE
2. 运行 start-backend.bat
3. 等待后端启动
4. 打开IDE
5. 开始使用
6. 关闭IDE
7. 手动停止后端（或留在后台）
```

### 现在（全自动）

```
1. 安装IDE
2. 打开IDE ← 自动启动后端
3. 开始使用
4. 关闭IDE ← 自动停止后端
```

## 🎯 优势

1. **零配置** - 用户无需任何额外操作
2. **资源节约** - 关闭IDE后立即释放资源
3. **防止冲突** - 避免多个后端实例同时运行
4. **错误恢复** - 即使启动失败，IDE仍可正常使用（只是无AI功能）

## ⚠️ 注意事项

### 首次启动延迟

首次启动可能需要5-10秒来启动后端服务，这是正常的。

### 依赖要求

确保项目根目录有完整的依赖：
```bash
cd openclaude-main
bun install
```

### 端口占用

如果端口50051被占用，后端可能启动失败。检查方法：
```bash
# Windows
netstat -ano | findstr :50051

# Linux/Mac
lsof -i :50051
```

## 🚀 下一步优化建议

1. **进度提示** - 在UI中显示"正在启动AI服务..."
2. **重试机制** - 启动失败时自动重试
3. **日志查看** - 提供后端日志查看功能
4. **配置选项** - 允许用户自定义端口
5. **健康检查** - 定期检测后端状态

---

**实现日期**: 2026-05-12  
**版本**: v0.1.0  
**状态**: ✅ 已完成并部署
