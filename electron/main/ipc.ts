import { dialog, ipcMain, app } from 'electron'
import { join } from 'path'
import type { ApiResult, Role, Settings, User } from '../shared/types'
import * as auth from './services/auth'
import * as types from './services/serviceTypes'
import * as sessions from './services/sessions'
import * as entries from './services/entries'
import * as reports from './services/reports'
import * as backup from './services/backup'
import * as exporter from './services/export'
import { listPrinters, printTicket } from './services/printing'
import { getAllSettings, updateSettings } from './db/settings'

let currentUser: User | null = null

function requireUser(): User {
  if (!currentUser) throw new Error('يجب تسجيل الدخول')
  return currentUser
}

function requireAdmin(): User {
  const u = requireUser()
  if (u.role !== 'admin') throw new Error('هذه العملية للمدير فقط')
  return u
}

/** Localized "replace all data?" confirmation shown before a restore. */
async function confirmRestore(): Promise<boolean> {
  const en = getAllSettings().lang === 'en'
  const res = await dialog.showMessageBox({
    type: 'warning',
    buttons: en ? ['Cancel', 'Restore'] : ['إلغاء', 'استعادة'],
    defaultId: 0,
    cancelId: 0,
    message: en
      ? 'All current data will be replaced with the selected backup. A safety copy of the current data is saved automatically. Continue?'
      : 'سيتم استبدال جميع البيانات الحالية بالنسخة المختارة. سيتم حفظ نسخة أمان من البيانات الحالية تلقائيًا. متابعة؟'
  })
  return res.response === 1
}

async function wrap<T>(fn: () => T | Promise<T>): Promise<ApiResult<T>> {
  try {
    return { ok: true, data: await fn() }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export function registerIpc(): void {
  // ---- auth ----
  ipcMain.handle('auth:state', () =>
    wrap(() => ({ firstRun: auth.isFirstRun(), user: currentUser }))
  )
  ipcMain.handle('auth:setup', (_e, p: { username: string; password: string }) =>
    wrap(() => {
      if (!auth.isFirstRun()) throw new Error('تم الإعداد بالفعل')
      const u = auth.createUser({ ...p, role: 'admin', display_name: p.username })
      currentUser = u
      return u
    })
  )
  ipcMain.handle('auth:login', (_e, p: { username: string; password: string }) =>
    wrap(() => {
      currentUser = auth.login(p.username, p.password)
      return currentUser
    })
  )
  ipcMain.handle('auth:logout', () => wrap(() => {
    currentUser = null
    return true
  }))

  // ---- users (admin) ----
  ipcMain.handle('users:list', () => wrap(() => (requireAdmin(), auth.listUsers())))
  ipcMain.handle(
    'users:create',
    (_e, p: { username: string; password: string; role: Role; display_name?: string }) =>
      wrap(() => (requireAdmin(), auth.createUser(p)))
  )
  ipcMain.handle('users:setActive', (_e, p: { id: number; active: boolean }) =>
    wrap(() => (requireAdmin(), auth.setUserActive(p.id, p.active)))
  )
  ipcMain.handle('users:resetPassword', (_e, p: { id: number; password: string }) =>
    wrap(() => (requireAdmin(), auth.resetPassword(p.id, p.password)))
  )

  // ---- service types ----
  ipcMain.handle('types:list', (_e, includeInactive?: boolean) =>
    wrap(() => types.listServiceTypes(!!includeInactive))
  )
  ipcMain.handle('types:create', (_e, p: { name: string; price: number; color?: string }) =>
    wrap(() => (requireAdmin(), types.createServiceType(p)))
  )
  ipcMain.handle('types:update', (_e, p: { id: number; patch: any }) =>
    wrap(() => (requireAdmin(), types.updateServiceType(p.id, p.patch)))
  )
  ipcMain.handle('types:reorder', (_e, ids: number[]) =>
    wrap(() => (requireAdmin(), types.reorderServiceTypes(ids)))
  )

  // ---- counter / entries ----
  ipcMain.handle('entries:active', () => wrap(() => entries.getActiveSessionEntries()))
  ipcMain.handle('entries:create', (_e, p: { type_id: number }) =>
    wrap(async () => {
      const u = requireUser()
      const entry = entries.createEntry({ type_id: p.type_id, user_id: u.id })
      const settings = getAllSettings()
      let printed = false
      let printError: string | undefined
      let pdfPath: string | undefined
      if (settings.auto_print) {
        try {
          const res = await printTicket(entry)
          if (res.method === 'printer') printed = true
          else pdfPath = res.pdfPath
        } catch (err) {
          printError = err instanceof Error ? err.message : String(err)
        }
      }
      return { entry, printed, printError, pdfPath }
    })
  )
  ipcMain.handle('entries:print', (_e, id: number) =>
    wrap(async () => {
      const entry = entries.getEntry(id)
      if (!entry) throw new Error('السجل غير موجود')
      return printTicket(entry)
    })
  )

  // ---- sessions ----
  ipcMain.handle('session:active', () => wrap(() => sessions.getOpenSession() ?? null))
  ipcMain.handle('session:checkNewDay', () => wrap(() => (requireUser(), sessions.checkStartNewDay())))
  ipcMain.handle('session:startNewDay', () =>
    wrap(() => {
      const u = requireUser()
      return sessions.startNewDay(u.id)
    })
  )

  // ---- reports (admin) ----
  ipcMain.handle('reports:daily', (_e, date: string) =>
    wrap(() => (requireAdmin(), reports.dailyReport(date)))
  )
  ipcMain.handle('reports:monthly', (_e, month: string) =>
    wrap(() => (requireAdmin(), reports.monthlyReport(month)))
  )
  ipcMain.handle('reports:range', (_e, p: { from: string; to: string }) =>
    wrap(() => (requireAdmin(), reports.rangeReport(p.from, p.to)))
  )
  ipcMain.handle(
    'reports:export',
    (_e, p: { kind: 'daily' | 'monthly' | 'range'; format: 'excel' | 'pdf'; key: string; to?: string }) =>
      wrap(async () => {
        requireAdmin()
        const ext = p.format === 'excel' ? 'xlsx' : 'pdf'
        const label = p.kind === 'range' ? `${p.key}_${p.to}` : p.key
        const def = `vetq-${p.kind}-${label}.${ext}`
        const res = await dialog.showSaveDialog({ defaultPath: def })
        if (res.canceled || !res.filePath) return false
        if (p.kind === 'range' && p.format === 'excel') await exporter.exportRangeExcel(p.key, p.to ?? p.key, res.filePath)
        else if (p.kind === 'range') await exporter.exportRangePdf(p.key, p.to ?? p.key, res.filePath)
        else if (p.kind === 'daily' && p.format === 'excel') await exporter.exportDailyExcel(p.key, res.filePath)
        else if (p.kind === 'daily') await exporter.exportDailyPdf(p.key, res.filePath)
        else if (p.format === 'excel') await exporter.exportMonthlyExcel(p.key, res.filePath)
        else await exporter.exportMonthlyPdf(p.key, res.filePath)
        return true
      })
  )

  // ---- settings ----
  ipcMain.handle('settings:get', () => wrap(() => getAllSettings()))
  ipcMain.handle('settings:update', (_e, patch: Partial<Settings>) =>
    wrap(() => {
      // theme and language are UI prefs settable by anyone; everything else admin-only
      const publicKeys = new Set(['theme', 'lang'])
      const keys = Object.keys(patch)
      if (!keys.every((k) => publicKeys.has(k))) requireAdmin()
      const str: Record<string, string> = {}
      for (const [k, v] of Object.entries(patch)) str[k] = typeof v === 'boolean' ? (v ? '1' : '0') : String(v)
      updateSettings(str as any)
      return getAllSettings()
    })
  )
  ipcMain.handle('printers:list', () => wrap(() => listPrinters()))

  // ---- backups (admin) ----
  ipcMain.handle('backup:now', () =>
    wrap(async () => {
      requireAdmin()
      const res = await dialog.showSaveDialog({
        defaultPath: join(app.getPath('documents'), `vetq-backup-${sessions.todayStr()}.db`)
      })
      if (res.canceled || !res.filePath) return false
      await backup.manualBackup(res.filePath)
      return true
    })
  )
  ipcMain.handle('backup:list', () => wrap(() => (requireAdmin(), backup.listBackups())))
  ipcMain.handle('backup:info', () => wrap(() => (requireAdmin(), backup.dbInfo())))
  ipcMain.handle('backup:reveal', () => wrap(() => (requireAdmin(), backup.revealBackupDir())))
  ipcMain.handle('backup:restore', () =>
    wrap(async () => {
      requireAdmin()
      const en = getAllSettings().lang === 'en'
      const res = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: en ? 'Database' : 'قاعدة البيانات', extensions: ['db'] }]
      })
      if (res.canceled || !res.filePaths[0]) return false
      if (!(await confirmRestore())) return false
      await backup.restoreFrom(res.filePaths[0])
      currentUser = null
      return true
    })
  )
  ipcMain.handle('backup:restoreFile', (_e, p: { path: string }) =>
    wrap(async () => {
      requireAdmin()
      if (!(await confirmRestore())) return false
      await backup.restoreFrom(p.path)
      currentUser = null
      return true
    })
  )
  ipcMain.handle('backup:chooseDir', () =>
    wrap(async () => {
      requireAdmin()
      const res = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
      if (res.canceled || !res.filePaths[0]) return null
      updateSettings({ backup_dir: res.filePaths[0] })
      return res.filePaths[0]
    })
  )
}

export function clearCurrentUser(): void {
  currentUser = null
}
