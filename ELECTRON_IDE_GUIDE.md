# IceCode IDE 打包指南

## 📦 自动化打包方案

现在IceCode IDE支持通过GitHub Actions自动打包，无需在本地进行复杂的构建操作。

### ✨ 优势

- ✅ **零本地配置** - 不需要安装Electron、Vite等复杂依赖
- ✅ **跨平台构建** - 同时生成Windows、macOS、Linux安装包
- ✅ **自动发布** - 打包完成后自动创建GitHub Release
- ✅ **一致性保证** - CI环境确保每次构建结果一致

---

## 🚀 使用方法

### 方法1：通过Git Tag触发（推荐）

```bash
# 1. 更新版本号
git tag v0.9.3

# 2. 推送tag到GitHub
git push origin v0.9.3

# 3. GitHub Actions会自动开始构建
# 4. 构建完成后会在GitHub Release页面生成安装包
```

### 方法2：手动触发工作流

1. 访问 GitHub Actions 页面：https://github.com/XiTu893/iceIDE/actions
2. 选择 "Build and Release IDE" 工作流
3. 点击 "Run workflow"
4. 可选：输入版本号
5. 点击运行

---

## 📁 生成的文件

### Windows
- `Ice Code IDE Setup 0.9.3.exe` - NSIS安装程序
- `Ice Code IDE 0.9.3-win.zip` - 便携版压缩包

### macOS
- `Ice Code IDE 0.9.3.dmg` - DMG磁盘映像
- `Ice Code IDE 0.9.3-mac.zip` - 便携版压缩包

### Linux
- `Ice Code IDE 0.9.3.AppImage` - AppImage便携应用
- `icecode-ide_0.9.3_amd64.deb` - Debian/Ubuntu安装包

---

## 🔧 本地开发模式

如果需要在本地测试Electron应用：

### 前提条件

```bash
# 安装依赖
cd ide
bun install
```

### 开发模式

```bash
# 启动Vite开发服务器 + Electron
bun run electron:dev
```

这会：
1. 启动Vite开发服务器（http://localhost:5173）
2. 自动打开Electron窗口
3. 支持热重载

### 本地打包

```bash
# 完整构建并打包
bun run scripts/package-simple.ts

# 或者分步执行
bun run build                    # 构建CLI
bun run vite build               # 构建前端
bun run tsc --project tsconfig.electron.json  # 编译Electron
npx electron-builder --win --x64 # 打包Windows版本
```

---

## ⚙️ 配置文件说明

### 核心文件

| 文件 | 用途 |
|------|------|
| `electron/main.ts` | Electron主进程，管理窗口和后端服务 |
| `electron/preload.ts` | 预加载脚本，桥接主进程和渲染进程 |
| `electron/renderer.tsx` | React渲染界面 |
| `electron/index.html` | HTML入口文件 |
| `vite.config.ts` | Vite构建配置 |
| `tsconfig.electron.json` | TypeScript配置 |
| `electron-builder.yml` | 打包配置 |
| `.github/workflows/build-ide.yml` | GitHub Actions工作流 |

### 修改打包配置

编辑 `ide/electron-builder.yml`：

```yaml
# 修改应用名称
productName: Your App Name

# 修改App ID
appId: com.yourcompany.app

# 添加额外文件
extraResources:
  - from: dist
    to: cli
```

---

## 🎨 自定义图标

当前使用占位图标，需要替换为真实的IceCode图标：

### 步骤

1. 准备一个512x512的PNG图标
2. 转换为所需格式：
   - Windows: [.ico](file://f:\project\AI\openclaude-main\ide\build\README.md) (使用 https://convertio.co/zh/png-ico/)
   - macOS: [.icns](file://f:\project\AI\openclaude-main\ide\build\README.md) (使用 https://cloudconvert.com/png-to-icns)
   - Linux: .png (保持512x512)

3. 将文件放入 `ide/build/` 目录：
   ```
   ide/build/
   ├── icon.ico
   ├── icon.icns
   └── icon.png
   ```

4. 重新触发打包

---

## 🐛 故障排查

### 问题1：GitHub Actions构建失败

**检查点：**
- 查看Actions日志中的错误信息
- 确认所有依赖都已正确安装
- 验证electron-builder.yml配置语法

### 问题2：本地打包找不到index.html

**解决方案：**
```bash
# 确保在正确的目录
cd ide

# 重新安装依赖
bun install

# 清理后重新构建
rm -rf dist
bun run vite build
```

### 问题3：Electron窗口空白

**可能原因：**
- Vite开发服务器未启动
- 端口被占用

**解决：**
```bash
# 检查5173端口是否可用
netstat -ano | findstr :5173

# 或手动启动
bun run vite
```

---

## 📊 构建时间参考

| 平台 | 预计时间 |
|------|---------|
| Windows | 8-12分钟 |
| macOS | 10-15分钟 |
| Linux | 6-10分钟 |
| 全部平台并行 | 10-15分钟 |

---

## 🔗 相关链接

- [GitHub Releases](https://github.com/XiTu893/iceIDE/releases)
- [GitHub Actions](https://github.com/XiTu893/iceIDE/actions)
- [Electron文档](https://www.electronjs.org/docs)
- [electron-builder文档](https://www.electron.build/)

---

## 💡 最佳实践

1. **使用Tag触发** - 每次发布新版本时创建tag
2. **语义化版本** - 遵循 SemVer (v0.9.3, v1.0.0等)
3. **测试后再发布** - 先在本地测试功能
4. **保留Artifacts** - GitHub默认保留30天
5. **定期清理** - 删除旧的Release以节省空间

---

## 📝 下一步计划

- [ ] 添加Monaco编辑器集成
- [ ] 实现文件浏览器
- [ ] 添加终端模拟器
- [ ] 支持插件系统
- [ ] 优化启动速度
