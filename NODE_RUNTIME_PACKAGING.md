# Node.js 运行时打包方案

## 📋 问题分析

IceCode IDE需要启动CLI后端服务（gRPC服务器），这需要Node.js运行时。有两种方案：

### 方案对比

| 方案 | 优点 | 缺点 | 推荐度 |
|------|------|------|--------|
| **A. 依赖系统Node.js** | 安装包小，更新方便 | 用户需手动安装Node.js | ⭐⭐⭐ |
| **B. 捆绑Node.js便携版** | 开箱即用，无需额外安装 | 安装包大(~30MB)，需维护版本 | ⭐⭐⭐⭐⭐ |

## ✅ 当前实现：方案A（依赖系统Node.js）

### 已实现功能

1. **CLI依赖包打包**
   - ✅ gRPC相关: `@grpc/grpc-js`, `@grpc/proto-loader`
   - ✅ AI提供商: `openai`, `anthropic`, `@google/generative-ai`
   - ✅ 核心工具: `axios`, `zod`, `chalk`, `commander`, `ora`
   - ✅ UI框架: `ink`, `react`, `react-dom`

2. **CLI构建产物**
   - ✅ `dist/cli.mjs` - CLI主入口
   - ✅ `bin/icecode` - 命令行启动脚本

3. **配置文件**
   - ✅ `package.json` - 依赖声明
   - ✅ `.npmrc` - 镜像配置

4. **启动脚本**
   - ✅ `resources/start-backend.sh` - 后端启动脚本

### 用户要求

使用此方案，用户需要：

```bash
# 1. 安装Node.js >= 22
# Windows: 下载安装 https://nodejs.org/
# macOS: brew install node
# Linux: sudo apt install nodejs npm

# 2. 验证安装
node --version  # 应显示 v22.x.x 或更高
npm --version

# 3. 安装IceCode IDE
# 运行安装包即可
```

## 🚀 可选方案B：捆绑Node.js便携版

如果需要完全独立的安装包，可以实现方案B：

### 实现步骤

#### 1. 下载Node.js便携版

```bash
# Windows
# 从 https://nodejs.org/dist/v22.x.x/node-v22.x.x-win-x64.zip 下载
# 解压到 ide/resources/node/

# macOS
# 从 https://nodejs.org/dist/v22.x.x/node-v22.x.x-darwin-x64.tar.gz 下载
# 解压到 ide/resources/node/

# Linux
# 从 https://nodejs.org/dist/v22.x.x/node-v22.x.x-linux-x64.tar.xz 下载
# 解压到 ide/resources/node/
```

#### 2. 修改 package.ts

添加以下函数：

```typescript
/**
 * 下载并打包Node.js便携版
 */
async function bundleNodeRuntime() {
  logStep(7, '打包Node.js运行时')
  
  const nodeDir = path.join(resourcesDir, 'node')
  const platform = process.platform
  const arch = process.arch
  
  let nodeUrl: string
  let nodeFileName: string
  
  if (platform === 'win32') {
    nodeUrl = `https://nodejs.org/dist/v22.12.0/node-v22.12.0-win-${arch}.zip`
    nodeFileName = 'node-windows.zip'
  } else if (platform === 'darwin') {
    nodeUrl = `https://nodejs.org/dist/v22.12.0/node-v22.12.0-darwin-${arch}.tar.gz`
    nodeFileName = 'node-macos.tar.gz'
  } else {
    nodeUrl = `https://nodejs.org/dist/v22.12.0/node-v22.12.0-linux-${arch}.tar.xz`
    nodeFileName = 'node-linux.tar.xz'
  }
  
  log(`下载Node.js便携版...`)
  log(`URL: ${nodeUrl}`)
  
  // 下载
  const downloadPath = path.join(resourcesDir, nodeFileName)
  await $`curl -L -o ${downloadPath} ${nodeUrl}`
  
  // 解压
  log('解压Node.js...')
  if (platform === 'win32') {
    await $`tar -xf ${downloadPath} -C ${resourcesDir}`
  } else {
    await $`tar -xzf ${downloadPath} -C ${resourcesDir}`
  }
  
  // 清理下载文件
  await $`rm ${downloadPath}`
  
  logSuccess('Node.js运行时打包完成')
}
```

#### 3. 更新启动脚本

修改 `start-backend.sh` 使用 bundled Node.js:

```bash
#!/bin/bash
# IceCode Backend Starter with Bundled Node.js

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_BIN="$SCRIPT_DIR/node/bin/node"

# 检查bundled Node.js是否存在
if [ -f "$NODE_BIN" ]; then
  echo "使用bundled Node.js: $NODE_BIN"
  CLI_NODE="$NODE_BIN"
else
  echo "使用系统Node.js"
  CLI_NODE="node"
fi

# 启动gRPC服务器
cd "$SCRIPT_DIR/cli"
$CLI_NODE dist/cli.mjs grpc-server --port 50051
```

#### 4. 更新Electron主进程

修改 `ide/electron/main.ts` 中的 `startOpenClaudeBackend()` 函数：

```typescript
async function startOpenClaudeBackend(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const projectRoot = path.join(__dirname, '../..')
      const resourcesDir = path.join(projectRoot, 'resources')
      
      // 检测Node.js路径
      let nodePath = 'node'  // 默认使用系统Node.js
      
      const bundledNode = path.join(
        resourcesDir, 
        'node',
        process.platform === 'win32' ? 'node.exe' : 'bin/node'
      )
      
      if (fs.existsSync(bundledNode)) {
        nodePath = bundledNode
        console.log('[OpenClaude] Using bundled Node.js:', nodePath)
      } else {
        console.log('[OpenClaude] Using system Node.js')
      }
      
      // 使用检测到的Node.js启动
      openClaudeProcess = spawn(nodePath, [
        'dist/cli.mjs',
        'grpc-server',
        '--port', '50051'
      ], {
        cwd: path.join(resourcesDir, 'cli'),
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          NODE_ENV: 'production',
        },
      })
      
      // ... 其余代码不变
      
    } catch (error) {
      reject(error)
    }
  })
}
```

### 方案B的优势

1. **完全独立** - 无需用户安装任何依赖
2. **版本控制** - 确保使用正确的Node.js版本
3. **离线可用** - 完全离线环境也能运行
4. **用户体验** - 安装即用，零配置

### 方案B的劣势

1. **安装包增大** - 增加约30-40MB
2. **维护成本** - 需要定期更新Node.js版本
3. **平台差异** - 需要为每个平台单独打包

## 💡 推荐方案

### 开发阶段：方案A
- 快速迭代
- 安装包小
- 便于调试

### 发布阶段：方案B（可选）
- 更好的用户体验
- 减少用户配置错误
- 适合企业部署

## 📊 体积对比

| 组件 | 大小 |
|------|------|
| CLI构建产物 | ~5MB |
| CLI依赖包 | ~50MB |
| Electron应用 | ~80MB |
| Node.js便携版 | ~30MB |
| **总计（方案A）** | **~135MB** |
| **总计（方案B）** | **~165MB** |

## 🔧 当前配置

目前采用**方案A**，因为：

1. ✅ 大多数开发者已有Node.js环境
2. ✅ 安装包更小，下载更快
3. ✅ 用户可以自由选择Node.js版本
4. ✅ 简化打包流程

如果未来需要改为方案B，只需：
1. 添加 `bundleNodeRuntime()` 函数
2. 更新启动脚本
3. 修改Electron主进程
4. 在 `package.ts` 中调用新函数

---

**最后更新**: 2026-05-12  
**当前方案**: A（依赖系统Node.js）  
**建议**: 根据用户反馈决定是否切换到方案B
