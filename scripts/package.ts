/**
 * IceCode IDE 打包脚本
 * 
 * 功能：
 * 1. 构建CLI核心代码
 * 2. 构建Electron应用
 * 3. 调用electron-builder打包为安装包
 * 4. 生成打包报告
 */

import { $ } from 'bun'
import fs from 'fs'
import path from 'path'

const ROOT_DIR = process.cwd()
const IDE_DIR = path.join(ROOT_DIR, 'ide')
const RELEASE_DIR = path.join(IDE_DIR, 'release')

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
}

function log(message: string, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`)
}

function logStep(step: number, message: string) {
  log(`\n[${step}] ${message}`, colors.blue)
}

function logSuccess(message: string) {
  log(`✓ ${message}`, colors.green)
}

function logError(message: string) {
  log(`✗ ${message}`, colors.red)
}

function logWarning(message: string) {
  log(`⚠ ${message}`, colors.yellow)
}

/**
 * 检查必要的工具和依赖
 */
async function checkPrerequisites() {
  logStep(0, '检查前置条件')
  
  // 检查Bun
  try {
    await $`bun --version`.quiet()
    logSuccess('Bun 已安装')
  } catch {
    logError('Bun 未安装，请先安装 Bun')
    process.exit(1)
  }
  
  // 检查Node.js
  try {
    const version = await $`node --version`.text()
    logSuccess(`Node.js ${version.trim()} 已安装`)
  } catch {
    logError('Node.js 未安装')
    process.exit(1)
  }
  
  // 检查IDE目录
  if (!fs.existsSync(IDE_DIR)) {
    logError(`IDE目录不存在: ${IDE_DIR}`)
    process.exit(1)
  }
  logSuccess('IDE目录存在')
}

/**
 * 安装根项目依赖
 */
async function installRootDependencies() {
  logStep(1, '安装根项目依赖')
  
  log('安装根项目依赖...')
  await $`bun install`.cwd(ROOT_DIR)
  logSuccess('根项目依赖安装完成')
}

/**
 * 构建CLI核心代码
 */
async function buildCLI() {
  logStep(2, '构建CLI核心代码')
  
  log('构建CLI...')
  await $`bun run build`.cwd(ROOT_DIR)
  logSuccess('CLI构建完成')
  
  // 验证构建产物
  const cliDist = path.join(ROOT_DIR, 'dist', 'cli.mjs')
  if (!fs.existsSync(cliDist)) {
    logError('CLI构建产物不存在')
    process.exit(1)
  }
  logSuccess('CLI构建产物验证通过')
}

/**
 * 安装IDE依赖
 */
async function installIDEDependencies() {
  logStep(3, '安装IDE依赖')
  
  log('安装IDE依赖...')
  await $`bun install`.cwd(IDE_DIR)
  logSuccess('IDE依赖安装完成')
}

/**
 * 构建IDE前端
 */
async function buildIDEFrontend() {
  logStep(4, '构建IDE前端')
  
  log('构建IDE前端...')
  await $`bun run vite build`.cwd(IDE_DIR)
  logSuccess('IDE前端构建完成')
  
  // 验证构建产物
  if (!fs.existsSync(BUILD_DIR)) {
    logError('IDE前端构建产物不存在')
    process.exit(1)
  }
  logSuccess('IDE前端构建产物验证通过')
}

/**
 * 编译Electron主进程
 */
async function buildElectronMain() {
  logStep(5, '编译Electron主进程')
  
  log('编译Electron主进程...')
  await $`bun run tsc --project tsconfig.electron.json`.cwd(IDE_DIR)
  logSuccess('Electron主进程编译完成')
  
  // 验证编译产物
  const electronDist = path.join(IDE_DIR, 'dist-electron')
  if (!fs.existsSync(electronDist)) {
    logError('Electron编译产物不存在')
    process.exit(1)
  }
  logSuccess('Electron编译产物验证通过')
}

/**
 * 复制必要的资源文件
 */
async function copyResources() {
  logStep(6, '复制资源文件和运行时')
  
  const resourcesDir = path.join(IDE_DIR, 'resources')
  
  // 创建资源目录
  if (!fs.existsSync(resourcesDir)) {
    fs.mkdirSync(resourcesDir, { recursive: true })
  }
  
  // 1. 复制CLI构建产物到IDE资源目录
  const cliDest = path.join(resourcesDir, 'cli')
  if (!fs.existsSync(cliDest)) {
    fs.mkdirSync(cliDest, { recursive: true })
  }
  
  log('复制CLI构建产物...')
  await $`cp -r ${path.join(ROOT_DIR, 'dist')}/* ${cliDest}/`
  logSuccess('CLI构建产物复制完成')
  
  // 2. 复制CLI的node_modules（生产依赖）
  log('复制CLI依赖包...')
  const cliNodeModules = path.join(cliDest, 'node_modules')
  if (!fs.existsSync(cliNodeModules)) {
    fs.mkdirSync(cliNodeModules, { recursive: true })
  }
  
  // 只复制必要的生产依赖
  const essentialPackages = [
    '@grpc/grpc-js',
    '@grpc/proto-loader',
    'openai',
    'anthropic',
    '@google/generative-ai',
    'axios',
    'zod',
    'chalk',
    'commander',
    'ora',
    'ink',
    'react',
    'react-dom',
  ]
  
  const rootModules = path.join(ROOT_DIR, 'node_modules')
  for (const pkg of essentialPackages) {
    const srcPkg = path.join(rootModules, pkg)
    const destPkg = path.join(cliNodeModules, pkg)
    if (fs.existsSync(srcPkg)) {
      await $`cp -r ${srcPkg} ${destPkg}`.quiet()
      logSuccess(`复制依赖: ${pkg}`)
    }
  }
  
  // 3. 复制bin目录（CLI入口）
  const binDest = path.join(cliDest, 'bin')
  if (!fs.existsSync(binDest)) {
    fs.mkdirSync(binDest, { recursive: true })
  }
  await $`cp ${path.join(ROOT_DIR, 'bin', 'icecode')} ${binDest}/`
  logSuccess('复制CLI入口文件')
  
  // 4. 复制package.json和配置文件
  const configFiles = ['package.json', '.npmrc']
  for (const file of configFiles) {
    const src = path.join(ROOT_DIR, file)
    const dest = path.join(resourcesDir, file)
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest)
      logSuccess(`复制 ${file}`)
    }
  }
  
  // 5. 检测并提示Node.js运行时
  log('\n检查Node.js运行时...', colors.yellow)
  const nodePath = process.execPath
  const nodeVersion = process.version
  log(`当前Node.js: ${nodeVersion} (${nodePath})`)
  logWarning('注意: Node.js运行时不会自动打包到安装包中')
  logWarning('用户需要在系统中安装Node.js >= 22')
  logWarning('或者可以手动将Node.js便携版放入 resources/node/ 目录')
  
  // 6. 创建启动脚本
  const startScriptPath = path.join(resourcesDir, 'start-backend.sh')
  const startScriptContent = `#!/bin/bash
# IceCode Backend Starter
cd "$(dirname "$0")/cli"
node dist/cli.mjs grpc-server --port 50051
`
  fs.writeFileSync(startScriptPath, startScriptContent)
  logSuccess('创建后端启动脚本')
}

/**
 * 打包IDE为安装包
 */
async function packageIDE() {
  logStep(7, '打包IDE安装包')
  
  // 创建release目录
  if (!fs.existsSync(RELEASE_DIR)) {
    fs.mkdirSync(RELEASE_DIR, { recursive: true })
  }
  
  log('使用electron-builder打包...')
  
  // 设置环境变量
  process.env.ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/'
  
  try {
    // Windows平台
    if (process.platform === 'win32') {
      log('打包Windows版本...')
      await $`bun run electron-builder --win --x64`.cwd(IDE_DIR)
      logSuccess('Windows版本打包完成')
    }
    
    // macOS平台
    if (process.platform === 'darwin') {
      log('打包macOS版本...')
      await $`bun run electron-builder --mac`.cwd(IDE_DIR)
      logSuccess('macOS版本打包完成')
    }
    
    // Linux平台
    if (process.platform === 'linux') {
      log('打包Linux版本...')
      await $`bun run electron-builder --linux`.cwd(IDE_DIR)
      logSuccess('Linux版本打包完成')
    }
  } catch (error) {
    logError('打包失败')
    console.error(error)
    process.exit(1)
  }
  
  // 验证安装包
  const packages = fs.readdirSync(RELEASE_DIR)
  if (packages.length === 0) {
    logWarning('未找到生成的安装包')
  } else {
    logSuccess(`生成了 ${packages.length} 个安装包:`)
    packages.forEach(pkg => {
      const stats = fs.statSync(path.join(RELEASE_DIR, pkg))
      const size = (stats.size / 1024 / 1024).toFixed(2)
      log(`  - ${pkg} (${size} MB)`, colors.green)
    })
  }
}

/**
 * 生成打包报告
 */
function generateReport() {
  logStep(8, '生成打包报告')
  
  const report: any = {
    timestamp: new Date().toISOString(),
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    bunVersion: 'unknown',
    directories: {
      root: ROOT_DIR,
      ide: IDE_DIR,
      release: RELEASE_DIR,
    },
    packages: [],
  }
  
  // 获取Bun版本
  try {
    report.bunVersion = require('child_process').execSync('bun --version').toString().trim()
  } catch {
    report.bunVersion = 'unknown'
  }
  
  // 列出所有生成的包
  if (fs.existsSync(RELEASE_DIR)) {
    const files = fs.readdirSync(RELEASE_DIR)
    report.packages = files.map(file => {
      const stats = fs.statSync(path.join(RELEASE_DIR, file))
      return {
        name: file,
        size: stats.size,
        sizeMB: (stats.size / 1024 / 1024).toFixed(2),
      }
    })
  }
  
  // 保存报告
  const reportPath = path.join(RELEASE_DIR, 'build-report.json')
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  logSuccess(`打包报告已保存: ${reportPath}`)
  
  // 打印摘要
  log('\n📦 打包摘要:', colors.blue)
  log(`  平台: ${report.platform} (${report.arch})`)
  log(`  Node.js: ${report.nodeVersion}`)
  log(`  Bun: ${report.bunVersion}`)
  log(`  生成包数: ${report.packages.length}`)
  if (report.packages.length > 0) {
    const totalSize = report.packages.reduce((sum: number, p: any) => sum + parseFloat(p.sizeMB), 0)
    log(`  总大小: ${totalSize.toFixed(2)} MB`)
  }
}

/**
 * 主函数
 */
async function main() {
  log('\n╔════════════════════════════════════════╗')
  log('║   IceCode IDE 打包工具                  ║')
  log('╚════════════════════════════════════════╝\n', colors.green)
  
  const startTime = Date.now()
  
  try {
    // 执行打包流程
    await checkPrerequisites()
    await installRootDependencies()
    await buildCLI()
    await installIDEDependencies()
    await buildIDEFrontend()
    await buildElectronMain()
    await copyResources()
    await packageIDE()
    generateReport()
    
    const endTime = Date.now()
    const duration = ((endTime - startTime) / 1000 / 60).toFixed(2)
    
    log('\n╔════════════════════════════════════════╗')
    log('║   ✓ 打包完成！                         ║')
    log('╚════════════════════════════════════════╝', colors.green)
    log(`\n总耗时: ${duration} 分钟`)
    log(`安装包位置: ${RELEASE_DIR}\n`, colors.green)
    
  } catch (error) {
    logError('\n打包失败！')
    console.error(error)
    process.exit(1)
  }
}

// 运行主函数
main()
