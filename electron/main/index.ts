import { app, BrowserWindow, dialog, shell } from 'electron'
import { join } from 'path'
import { appendFileSync, existsSync, mkdirSync } from 'fs'
import { initDb } from './db'
import { registerIpc } from './ipc'
import { autoBackupIfNeeded } from './services/backup'

const isDev = !app.isPackaged

/** Records a startup failure to a log file and surfaces it instead of hanging silently. */
function reportFatal(context: string, err: unknown): void {
  const detail = err instanceof Error ? err.stack || err.message : String(err)
  const line = `[${new Date().toISOString()}] ${context}: ${detail}\n`
  try {
    const dir = app.getPath('userData')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    appendFileSync(join(dir, 'vetq-error.log'), line)
  } catch {
    // ignore logging failures
  }
  dialog.showErrorBox('VetQ — startup error', `${context}\n\n${detail}`)
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    title: 'VetQ',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.once('ready-to-show', () => win.show())
  // Safety net: if 'ready-to-show' never fires (e.g. the renderer fails to paint),
  // show the window anyway so the app never sits invisibly in the background.
  setTimeout(() => {
    if (!win.isDestroyed() && !win.isVisible()) win.show()
  }, 4000)

  win.webContents.on('did-fail-load', (_e, code, desc) => {
    reportFatal('Failed to load the user interface', `(${code}) ${desc}`)
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

async function start(): Promise<void> {
  try {
    initDb()
  } catch (err) {
    // Almost always a native-module (better-sqlite3) ABI mismatch in a bad build.
    reportFatal('Could not open the database', err)
    app.quit()
    return
  }

  registerIpc()
  try {
    await autoBackupIfNeeded()
  } catch {
    // non-fatal; backup failures shouldn't block startup
  }
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}

// Single instance: a second launch focuses the existing window instead of
// spawning another hidden background process.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
    }
  })

  app.whenReady().then(start)

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
