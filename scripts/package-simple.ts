/**
 * IceCode IDE 打包脚本（简化版）
 * 
 * 功能：
 * 1. 构建CLI核心代码
 * 2. 构建Electron应用
 * 3. 调用electron-builder打包为安装包
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

/**
 * 检查前置条件
 */
async function checkPrerequisites() {
  logStep(0, '检查前置条件')
  
  // 检查Bun
  try {
    await $`bun --version`.quiet()
    logSuccess('Bun 已安装')
  } catch {
    logError('未找到 Bun，请先安装 Bun')
    process.exit(1)
  }
  
  // 检查Node.js
  try {
    const version = await $`node --version`.quiet().text()
    logSuccess(`Node.js ${version.trim()} 已安装`)
  } catch {
    logError('未找到 Node.js，请先安装 Node.js >= 22')
    process.exit(1)
  }
  
  // 检查IDE目录
  if (!fs.existsSync(IDE_DIR)) {
    logError('IDE目录不存在')
    process.exit(1)
  }
  logSuccess('IDE目录存在')
}

/**
 * 安装根项目依赖并构建CLI
 */
async function buildCLI() {
  logStep(1, '构建CLI核心代码')
  
  log('安装根项目依赖...')
  await $`bun install`.cwd(ROOT_DIR)
  
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
 * 安装IDE依赖并构建Electron应用
 */
async function buildElectronApp() {
  logStep(2, '构建Electron应用')
  
  log('安装IDE依赖...')
  await $`bun install`.cwd(IDE_DIR)
  
  log('构建CLI (IDE内部)...')
  await $`bun run build`.cwd(IDE_DIR)
  
  log('构建Vite前端...')
  await $`bun run vite build`.cwd(IDE_DIR)
  
  log('编译Electron主进程...')
  await $`bun run tsc --project tsconfig.electron.json`.cwd(IDE_DIR)
  
  logSuccess('Electron应用构建完成')
}

/**
 * 打包为安装包
 */
async function packageIDE() {
  logStep(3, '打包IDE安装包')
  
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
      await $`npx electron-builder --win --x64`.cwd(IDE_DIR)
      logSuccess('Windows版本打包完成')
    }
    
    // macOS平台
    if (process.platform === 'darwin') {
      log('打包macOS版本...')
      await $`npx electron-builder --mac`.cwd(IDE_DIR)
      logSuccess('macOS版本打包完成')
    }
    
    // Linux平台
    if (process.platform === 'linux') {
      log('打包Linux版本...')
      await $`npx electron-builder --linux`.cwd(IDE_DIR)
      logSuccess('Linux版本打包完成')
    }
  } catch (error) {
    logError('打包失败')
    console.error(error)
    process.exit(1)
  }
  
  // 验证安装包
  const packages = fs.readdirSync(RELEASE_DIR).filter(f => 
    f.endsWith('.exe') || f.endsWith('.dmg') || f.endsWith('.AppImage') || 
    f.endsWith('.deb') || f.endsWith('.zip')
  )
  
  if (packages.length === 0) {
    log('⚠ 未找到生成的安装包', colors.yellow)
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
    await buildCLI()
    await buildElectronApp()
    await packageIDE()
    
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
