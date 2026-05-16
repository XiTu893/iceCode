#!/usr/bin/env bun
/**
 * Download and setup portable Bun runtime for IceCode IDE
 * This script downloads Bun.exe and copies backend source files
 */

import fs from 'fs'
import path from 'path'
import os from 'os'
import https from 'https'
import { spawn } from 'child_process'

const PROJECT_ROOT = path.resolve(import.meta.dir, '..')
const BUILD_DIR = path.join(PROJECT_ROOT, 'ide', 'build', 'backend')
const BUN_VERSION = '1.3.13' // Match current version

async function main() {
  console.log('📦 Setting up portable Bun runtime...')
  console.log(`📍 Build directory: ${BUILD_DIR}`)
  
  // Create build directory
  if (!fs.existsSync(BUILD_DIR)) {
    fs.mkdirSync(BUILD_DIR, { recursive: true })
    console.log('✅ Created backend build directory')
  }

  // Step 1: Download portable Bun
  await downloadPortableBun()
  
  // Step 2: Copy backend source files
  await copyBackendFiles()
  
  // Step 3: Copy dependencies
  await copyDependencies()
  
  console.log('\n✅ Portable Bun setup complete!')
  console.log(`📁 Backend directory: ${BUILD_DIR}`)
  console.log(`🚀 Ready to package with Electron`)
}

async function downloadPortableBun() {
  console.log('\n⬇️  Downloading portable Bun...')
  
  const bunExePath = path.join(BUILD_DIR, 'bun.exe')
  
  // Check if already downloaded
  if (fs.existsSync(bunExePath)) {
    console.log('✅ Bun.exe already exists, skipping download')
    return
  }
  
  try {
    // Download Bun for Windows x64
    const downloadUrl = `https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/bun-windows-x64.zip`
    const zipPath = path.join(os.tmpdir(), `bun-${BUN_VERSION}.zip`)
    
    console.log(`Downloading from: ${downloadUrl}`)
    console.log(`Saving to: ${zipPath}`)
    
    // Download using Node.js https module
    await downloadFile(downloadUrl, zipPath)
    
    console.log('✅ Download complete, extracting...')
    
    // Extract using PowerShell (spawn directly)
    await runPowerShell(`Expand-Archive -Path '${zipPath}' -DestinationPath '${BUILD_DIR}' -Force`)
    
    // Move bun.exe from extracted folder to backend directory
    const extractedBun = path.join(BUILD_DIR, 'bun-windows-x64', 'bun.exe')
    if (fs.existsSync(extractedBun)) {
      fs.renameSync(extractedBun, bunExePath)
      // Clean up extracted folder
      fs.rmSync(path.join(BUILD_DIR, 'bun-windows-x64'), { recursive: true, force: true })
    }
    
    // Clean up zip file
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath)
    }
    
    console.log('✅ Bun.exe extracted successfully')
    
  } catch (error) {
    console.error('❌ Failed to download Bun:', error)
    console.log('\n💡 Alternative: Manually download Bun from https://bun.sh/install')
    console.log(`   Then copy bun.exe to: ${bunExePath}`)
    throw error
  }
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirect
        https.get(response.headers.location!, (redirectResponse) => {
          redirectResponse.pipe(file)
          file.on('finish', () => {
            file.close()
            resolve()
          })
        }).on('error', (err) => {
          fs.unlink(dest, () => reject(err))
        })
      } else {
        response.pipe(file)
        file.on('finish', () => {
          file.close()
          resolve()
        })
      }
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err))
    })
  })
}

function runPowerShell(command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ps = spawn('powershell.exe', ['-Command', command], {
      stdio: 'inherit'
    })
    
    ps.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`PowerShell exited with code ${code}`))
      }
    })
    
    ps.on('error', reject)
  })
}

async function copyBackendFiles() {
  console.log('\n📋 Copying backend source files...')
  
  const srcDir = path.join(PROJECT_ROOT, 'src')
  const scriptsDir = path.join(PROJECT_ROOT, 'scripts')
  const backendSrcDir = path.join(BUILD_DIR, 'src')
  const backendScriptsDir = path.join(BUILD_DIR, 'scripts')
  
  // Copy src directory
  if (fs.existsSync(srcDir)) {
    await runRobocopy(srcDir, backendSrcDir)
    console.log('✅ Copied src directory')
  }
  
  // Copy scripts directory
  if (fs.existsSync(scriptsDir)) {
    await runRobocopy(scriptsDir, backendScriptsDir)
    console.log('✅ Copied scripts directory')
  }
  
  // Copy essential config files
  const filesToCopy = [
    'package.json',
    'tsconfig.json',
    'bun.lock'
  ]
  
  for (const file of filesToCopy) {
    const src = path.join(PROJECT_ROOT, file)
    const dest = path.join(BUILD_DIR, file)
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest)
      console.log(`✅ Copied ${file}`)
    }
  }
}

async function copyDependencies() {
  console.log('\n📦 Copying node_modules (essential only)...')
  
  const nodeModulesSrc = path.join(PROJECT_ROOT, 'node_modules')
  const nodeModulesDest = path.join(BUILD_DIR, 'node_modules')
  
  if (!fs.existsSync(nodeModulesSrc)) {
    console.log('⚠️  node_modules not found, skipping')
    return
  }
  
  // Copy entire node_modules (simpler approach)
  // For production, you might want to prune unnecessary packages
  await runRobocopy(nodeModulesSrc, nodeModulesDest)
  console.log('✅ Copied node_modules')
}

function runRobocopy(src: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const robocopy = spawn('robocopy', [
      src,
      dest,
      '/E',     // Copy subdirectories
      '/NFL',   // No file list
      '/NDL',   // No directory list
      '/NJH',   // No job header
      '/NJS',   // No job summary
      '/nc',    // No class
      '/ns',    // No size
      '/np'     // No progress
    ], {
      stdio: 'pipe'
    })
    
    robocopy.on('close', (code) => {
      // Robocopy exit codes: 0-7 are success, 8+ are errors
      if (code !== null && code < 8) {
        resolve()
      } else {
        reject(new Error(`Robocopy exited with code ${code}`))
      }
    })
    
    robocopy.on('error', reject)
  })
}

main().catch((error) => {
  console.error('\n❌ Setup failed:', error)
  process.exit(1)
})
