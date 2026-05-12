# IceCode IDE 打包指南

## 📦 一键打包

### 快速开始

```bash
# 在项目根目录运行
bun run ide:package
```

这将自动执行以下流程：
1. ✅ 检查前置条件（Bun、Node.js）
2. ✅ 安装所有依赖
3. ✅ 构建CLI核心代码
4. ✅ 构建IDE前端
5. ✅ 编译Electron主进程
6. ✅ 复制必要资源
7. ✅ 打包为安装包
8. ✅ 生成打包报告

### 手动分步执行

如果需要分步执行或调试：

```bash
# 1. 构建CLI
bun run build

# 2. 进入IDE目录
cd ide

# 3. 安装IDE依赖
bun install

# 4. 构建前端
bun run vite build

# 5. 编译Electron
bun run tsc --project tsconfig.electron.json

# 6. 打包（根据平台）
bun run electron-builder --win --x64    # Windows
bun run electron-builder --mac          # macOS
bun run electron-builder --linux        # Linux
```

## 🎯 输出文件

打包完成后，安装包位于 `ide/release/` 目录：

### Windows
- `Ice IDE-Setup-0.1.0.exe` - NSIS安装包
- 包含所有依赖，可离线安装

### macOS
- `Ice IDE-0.1.0.dmg` - DMG安装包
- 拖拽到Applications文件夹即可

### Linux
- `Ice IDE-0.1.0.AppImage` - 便携式应用
- `ice-ide_0.1.0_amd64.deb` - Debian包
- `ice-ide-0.1.0-x86_64.rpm` - RPM包

## 📋 前置要求

### 必需工具
- **Bun** >= 1.0 (推荐最新版本)
- **Node.js** >= 22
- **Git** (用于版本控制)

### 可选工具
- **Windows**: Visual Studio Build Tools (如需原生模块)
- **macOS**: Xcode Command Line Tools
- **Linux**: build-essential, libgtk-3-dev

### 安装Bun

```bash
# Windows (PowerShell)
powershell -c "irm bun.sh/install.ps1 | iex"

# macOS/Linux
curl -fsSL https://bun.sh/install | bash
```

## 🔧 配置选项

### 修改版本号

编辑 `ide/package.json`:
```json
{
  "version": "0.1.0",  // 修改这里
  "name": "ice-ide",
  ...
}
```

### 自定义应用信息

编辑 `ide/package.json` 的 `build` 部分:
```json
{
  "build": {
    "appId": "com.xitu893.iceide",
    "productName": "Ice IDE",
    ...
  }
}
```

### 添加应用图标

将图标文件放入 `ide/assets/` 目录：
- `icon.ico` - Windows图标 (256x256)
- `icon.icns` - macOS图标
- `icon.png` - Linux图标 (512x512)

然后更新 `ide/package.json`:
```json
{
  "build": {
    "win": {
      "icon": "assets/icon.ico"
    },
    "mac": {
      "icon": "assets/icon.icns"
    },
    "linux": {
      "icon": "assets/icon.png"
    }
  }
}
```

## 🚀 高级用法

### 仅打包特定平台

```bash
# 仅Windows
cd ide
bun run electron-builder --win --x64

# 仅macOS
bun run electron-builder --mac

# 仅Linux
bun run electron-builder --linux
```

### 使用国内镜像加速

如果下载Electron慢，设置环境变量：

```bash
# Windows PowerShell
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"

# macOS/Linux
export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/

# 然后运行打包
bun run ide:package
```

`.npmrc` 文件已配置国内镜像，通常无需手动设置。

### 清理构建产物

```bash
# 清理IDE构建产物
cd ide
rm -rf dist dist-electron release node_modules

# 清理根项目构建产物
cd ..
rm -rf dist node_modules
```

## 📊 打包报告

每次打包后会生成 `ide/release/build-report.json`，包含：

```json
{
  "timestamp": "2026-05-12T...",
  "platform": "win32",
  "arch": "x64",
  "nodeVersion": "v22.x.x",
  "bunVersion": "1.x.x",
  "packages": [
    {
      "name": "Ice IDE-Setup-0.1.0.exe",
      "size": 123456789,
      "sizeMB": "117.73"
    }
  ]
}
```

## ⚠️ 常见问题

### 1. 下载Electron失败

**问题**: 网络连接超时或失败

**解决**: 
```bash
# 使用国内镜像
export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
bun run ide:package
```

### 2. 原生模块编译失败

**问题**: Windows上缺少Build Tools

**解决**:
```bash
# 安装Windows Build Tools
npm install --global windows-build-tools
```

### 3. 内存不足

**问题**: 打包过程中内存溢出

**解决**:
```bash
# 增加Node.js内存限制
export NODE_OPTIONS="--max-old-space-size=4096"
bun run ide:package
```

### 4. 端口被占用

**问题**: 开发服务器端口冲突

**解决**:
```bash
# 查找并关闭占用端口的进程
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

## 🎨 自定义打包

### 修改应用名称

编辑 `ide/package.json`:
```json
{
  "build": {
    "productName": "你的应用名称",
    "nsis": {
      "shortcutName": "你的快捷方式名称"
    }
  }
}
```

### 添加额外文件

在 `ide/package.json` 中添加：
```json
{
  "build": {
    "extraResources": [
      "resources/**/*",
      "docs/**/*.md"
    ]
  }
}
```

### 代码签名（生产环境）

```json
{
  "build": {
    "win": {
      "certificateFile": "path/to/cert.pfx",
      "certificatePassword": "password"
    },
    "mac": {
      "identity": "Developer ID Application: Your Name (XXXXX)"
    }
  }
}
```

## 📝 脚本说明

`scripts/package.ts` 自动化流程：

1. **checkPrerequisites()** - 检查Bun、Node.js是否安装
2. **installRootDependencies()** - 安装根项目依赖
3. **buildCLI()** - 构建CLI核心代码
4. **installIDEDependencies()** - 安装IDE依赖
5. **buildIDEFrontend()** - 构建React前端
6. **buildElectronMain()** - 编译Electron主进程
7. **copyResources()** - 复制CLI和资源文件
8. **packageIDE()** - 调用electron-builder打包
9. **generateReport()** - 生成打包报告

## 🔗 相关链接

- **Electron Builder**: https://www.electron.build
- **Bun**: https://bun.sh
- **GitHub Actions**: `.github/workflows/build.yml` (自动打包)

---

**最后更新**: 2026-05-12  
**版本**: v0.1.0
