import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { spawn, ChildProcess } from 'child_process'

let mainWindow: BrowserWindow | null = null
let openClaudeProcess: ChildProcess | null = null

const isDev = process.env.NODE_ENV === 'development'

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

async function startOpenClaudeBackend(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const projectRoot = path.join(__dirname, '..')
      
      console.log('[IceCode] Starting backend service...')
      
      const cmd = 'node'
      const args = ['--experimental-vm-modules', 'dist/scripts/start-grpc.js']
      
      openClaudeProcess = spawn(cmd, args, {
        cwd: projectRoot,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          NODE_ENV: 'production',
          PORT: '50051'
        },
        shell: true
      })

      let isResolved = false

      openClaudeProcess.stdout?.on('data', (data: Buffer) => {
        const message = data.toString().trim()
        console.log('[IceCode]', message)
        
        if (!isResolved && (
          message.includes('started') || 
          message.includes('listening') || 
          message.includes('gRPC server') ||
          message.includes('Server started') ||
          message.includes('50051')
        )) {
          isResolved = true
          console.log('[IceCode] Backend service started successfully on port 50051')
          resolve()
        }
      })

      openClaudeProcess.stderr?.on('data', (data: Buffer) => {
        const message = data.toString().trim()
        console.error('[IceCode Error]', message)
      })

      openClaudeProcess.on('error', (error) => {
        console.error('[IceCode] Failed to start backend:', error)
        if (!isResolved) {
          reject(error)
        }
      })

      openClaudeProcess.on('exit', (code) => {
        console.log(`[IceCode] Backend process exited with code ${code}`)
      })

      setTimeout(() => {
        if (!isResolved) {
          console.log('[IceCode] Using fallback: assuming service will start')
          isResolved = true
          resolve()
        }
      }, 30000)
    } catch (error) {
      console.error('[IceCode] Exception while starting backend:', error)
      reject(error)
    }
  })
}

async function stopOpenClaudeBackend(): Promise<void> {
  return new Promise((resolve) => {
    if (!openClaudeProcess) {
      resolve()
      return
    }

    console.log('[IceCode] Stopping backend service...')

    const cleanup = () => {
      if (openClaudeProcess) {
        openClaudeProcess.removeAllListeners()
        openClaudeProcess = null
      }
      resolve()
    }

    openClaudeProcess.on('exit', cleanup)
    
    openClaudeProcess.kill('SIGTERM')

    setTimeout(() => {
      if (openClaudeProcess) {
        console.log('[IceCode] Force killing backend process')
        openClaudeProcess.kill('SIGKILL')
        cleanup()
      }
    }, 5000)
  })
}

app.whenReady().then(async () => {
  await startOpenClaudeBackend()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', async () => {
  if (process.platform !== 'darwin') {
    await stopOpenClaudeBackend()
    app.quit()
  }
})

app.on('before-quit', async (event) => {
  if (openClaudeProcess) {
    event.preventDefault()
    await stopOpenClaudeBackend()
    app.quit()
  }
})

ipcMain.handle('get-app-version', () => {
  return app.getVersion()
})
