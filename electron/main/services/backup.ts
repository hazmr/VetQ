import { app, shell } from 'electron'
import Database from 'better-sqlite3'
import { join } from 'path'
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, copyFileSync } from 'fs'
import { closeDb, getDb, getDbPath, initDb } from '../db'
import { getAllSettings, setSetting } from '../db/settings'
import { todayStr } from './sessions'
import type { DbInfo } from '../../shared/types'

function ts(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

/** Localized message helper for restore/migration errors shown to the user. */
function lmsg(ar: string, en: string): string {
  try {
    return getAllSettings().lang === 'en' ? en : ar
  } catch {
    return ar
  }
}

const REQUIRED_TABLES = ['users', 'service_types', 'work_sessions', 'entries', 'settings']

/** Confirms a file is a healthy SQLite database with the VetQ schema before we trust it. */
export function validateBackupFile(src: string): void {
  if (!existsSync(src)) throw new Error(lmsg('ملف النسخة الاحتياطية غير موجود', 'Backup file not found'))
  let probe: Database.Database
  try {
    probe = new Database(src, { readonly: true, fileMustExist: true })
  } catch {
    throw new Error(lmsg('الملف ليس قاعدة بيانات صالحة', 'This file is not a valid database'))
  }
  try {
    const integrity = probe.pragma('integrity_check', { simple: true }) as string
    if (integrity !== 'ok')
      throw new Error(lmsg('النسخة تالفة (فشل فحص السلامة)', 'Backup is corrupt (integrity check failed)'))
    const tables = (
      probe.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]
    ).map((r) => r.name)
    const missing = REQUIRED_TABLES.filter((t) => !tables.includes(t))
    if (missing.length)
      throw new Error(lmsg('هذا الملف ليس نسخة VetQ (جداول ناقصة)', 'This is not a VetQ backup (missing tables)'))
  } finally {
    probe.close()
  }
}

/** Consistent snapshot of the live DB to a destination file. */
export async function backupTo(destFile: string): Promise<void> {
  await getDb().backup(destFile)
}

export async function manualBackup(destFile: string): Promise<string> {
  await backupTo(destFile)
  return destFile
}

/**
 * Restore replaces the live DB file then re-initializes the connection.
 * The source is validated first, and the current data is snapshotted to a
 * `vetq-before-restore-*.db` safety copy so the restore is reversible.
 * Returns the safety-backup path.
 */
export async function restoreFrom(srcFile: string): Promise<string> {
  validateBackupFile(srcFile)

  // Reversible: snapshot current data before we overwrite it.
  let safety = ''
  try {
    safety = join(getBackupDir(), `vetq-before-restore-${ts()}.db`)
    await backupTo(safety)
  } catch {
    safety = ''
  }

  closeDb()
  const dbPath = getDbPath()
  // Remove WAL/SHM siblings so the restored file is authoritative.
  for (const ext of ['', '-wal', '-shm']) {
    const f = dbPath + ext
    if (existsSync(f)) unlinkSync(f)
  }
  copyFileSync(srcFile, dbPath)
  initDb()
  return safety
}

/** Opens the backups folder in the OS file manager. */
export function revealBackupDir(): Promise<string> {
  return shell.openPath(getBackupDir())
}

/** Live database stats — what a backup contains and whether it's healthy. */
export function dbInfo(): DbInfo {
  const db = getDb()
  const count = (sql: string): number => (db.prepare(sql).get() as { c: number }).c
  const range = db.prepare('SELECT MIN(business_date) a, MAX(business_date) b FROM work_sessions').get() as {
    a: string | null
    b: string | null
  }
  let integrity = 'ok'
  try {
    integrity = db.pragma('integrity_check', { simple: true }) as string
  } catch (e) {
    integrity = e instanceof Error ? e.message : String(e)
  }
  const base = getDbPath()
  let sizeBytes = 0
  for (const ext of ['', '-wal', '-shm']) {
    const f = base + ext
    if (existsSync(f)) sizeBytes += statSync(f).size
  }
  return {
    dbPath: base,
    sizeBytes,
    integrity,
    users: count('SELECT COUNT(*) c FROM users'),
    services: count('SELECT COUNT(*) c FROM service_types'),
    sessions: count('SELECT COUNT(*) c FROM work_sessions'),
    entries: count('SELECT COUNT(*) c FROM entries'),
    firstDate: range.a,
    lastDate: range.b
  }
}

function defaultBackupDir(): string {
  return join(app.getPath('userData'), 'backups')
}

export function getBackupDir(): string {
  const s = getAllSettings()
  const dir = s.backup_dir || defaultBackupDir()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

/** Runs once per calendar day; keeps only the most recent N backups. */
export async function autoBackupIfNeeded(): Promise<void> {
  const s = getAllSettings()
  if (!s.auto_backup) return
  const last = getDb().prepare("SELECT value FROM settings WHERE key='last_auto_backup'").get() as
    | { value: string }
    | undefined
  if (last?.value === todayStr()) return

  const dir = getBackupDir()
  const dest = join(dir, `vetq-${todayStr()}-${ts()}.db`)
  await backupTo(dest)
  setSetting('last_auto_backup', todayStr())
  pruneBackups(dir, s.backup_retention)
}

function pruneBackups(dir: string, keep: number): void {
  if (!keep || keep < 1) return
  const files = readdirSync(dir)
    .filter((f) => f.startsWith('vetq-') && f.endsWith('.db'))
    .map((f) => ({ f, t: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t)
  for (const old of files.slice(keep)) unlinkSync(join(dir, old.f))
}

export function listBackups(): { file: string; path: string; size: number; mtime: number }[] {
  const dir = getBackupDir()
  return readdirSync(dir)
    .filter((f) => f.endsWith('.db'))
    .map((f) => {
      const p = join(dir, f)
      const st = statSync(p)
      return { file: f, path: p, size: st.size, mtime: st.mtimeMs }
    })
    .sort((a, b) => b.mtime - a.mtime)
}
