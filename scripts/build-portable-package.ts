#!/usr/bin/env bun
/**
 * Complete build script for IceCode IDE portable package
 * This script orchestrates the entire build process:
 * 1. Setup portable Bun runtime
 * 2. Build frontend
 * 3. Compile Electron main process
 * 4. Package with electron-builder
 */

import { $ } from 'bun'
import fs from 'fs'
import path from 'path'

const PROJECT_ROOT = path.resolve(import.meta.dir, '..')
const IDE_DIR = path.join(PROJECT_ROOT, 'ide')
const BUILD_DIR = path.join(IDE_DIR, 'build')

console.log('🚀 Starting IceCode IDE build process...\n')

async function main() {
  try {
    // Step 1: Setup portable Bun
    console.log('═══════════════════════════════════════')
    console.log('Step 1: Setting up portable Bun runtime')
    console.log('═══════════════════════════════════════\n')
    
    await $`bun run ${PROJECT_ROOT}/scripts/setup-portable-bun.ts`
    console.log('\n✅ Portable Bun setup complete\n')
    
    // Step 2: Install IDE dependencies
    console.log('═══════════════════════════════════════')
    console.log('Step 2: Installing IDE dependencies')
    console.log('═══════════════════════════════════════\n')
    
    process.chdir(IDE_DIR)
    await $`bun install`
    console.log('\n✅ Dependencies installed\n')
    
    // Step 3: Build frontend (React app)
    console.log('═══════════════════════════════════════')
    console.log('Step 3: Building frontend (React + Vite)')
    console.log('═══════════════════════════════════════\n')
    
    await $`bun run build`
    console.log('\n✅ Frontend build complete\n')
    
    // Step 4: Compile Electron main process
    console.log('═══════════════════════════════════════')
    console.log('Step 4: Compiling Electron main process')
    console.log('═══════════════════════════════════════\n')
    
    await $`bun run build:electron`
    console.log('\n✅ Electron compilation complete\n')
    
    // Step 5: Package with electron-builder
    console.log('═══════════════════════════════════════')
    console.log('Step 5: Packaging with electron-builder')
    console.log('═══════════════════════════════════════\n')
    
    await $`bunx electron-builder --win --publish never`
    console.log('\n✅ Packaging complete\n')
    
    // Step 6: Verify output
    console.log('═══════════════════════════════════════')
    console.log('Step 6: Verifying build output')
    console.log('═══════════════════════════════════════\n')
    
    const releaseDir = path.join(IDE_DIR, 'release')
    if (fs.existsSync(releaseDir)) {
      const files = fs.readdirSync(releaseDir)
      console.log('📦 Build artifacts:')
      files.forEach(file => {
        const filePath = path.join(releaseDir, file)
        const stats = fs.statSync(filePath)
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2)
        console.log(`   - ${file} (${sizeMB} MB)`)
      })
    } else {
      console.log('⚠️  Release directory not found')
    }
    
    console.log('\n' + '='.repeat(50))
    console.log('🎉 BUILD SUCCESSFUL!')
    console.log('='.repeat(50))
    console.log(`\n📁 Output directory: ${releaseDir}`)
    console.log('\n📝 Usage instructions:')
    console.log('   1. Extract the ZIP file to any location')
    console.log('   2. Run IceCode IDE.exe')
    console.log('   3. The app will automatically start the backend')
    console.log('   4. No installation or environment setup required!\n')
    
  } catch (error) {
    console.error('\n❌ Build failed:', error)
    process.exit(1)
  }
}

main()
