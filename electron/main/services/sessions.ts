import { getDb } from '../db'
import type { StartDayCheck, WorkSession } from '../../shared/types'

export function todayStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function getOpenSession(): WorkSession | undefined {
  return getDb()
    .prepare('SELECT * FROM work_sessions WHERE closed_at IS NULL ORDER BY id DESC LIMIT 1')
    .get() as WorkSession | undefined
}

function openNewSession(userId: number): WorkSession {
  const info = getDb()
    .prepare('INSERT INTO work_sessions (opened_by, business_date) VALUES (?, ?)')
    .run(userId, todayStr())
  return getDb()
    .prepare('SELECT * FROM work_sessions WHERE id = ?')
    .get(info.lastInsertRowid) as WorkSession
}

function closeSession(id: number): void {
  getDb()
    .prepare("UPDATE work_sessions SET closed_at = datetime('now','localtime') WHERE id = ?")
    .run(id)
}

/**
 * Returns the active session for today, opening (or rolling over) one if needed.
 * Auto rollover happens when the open session belongs to a previous calendar day.
 */
export function ensureActiveSession(userId: number): WorkSession {
  const open = getOpenSession()
  if (!open) return openNewSession(userId)
  if (open.business_date < todayStr()) {
    const tx = getDb().transaction(() => {
      closeSession(open.id)
      return openNewSession(userId)
    })
    return tx()
  }
  return open
}

/**
 * Guard for the manual "Start new day" button. If a session was already
 * opened today, the caller must confirm before we reset numbering.
 */
export function checkStartNewDay(): StartDayCheck {
  const open = getOpenSession()
  if (open && open.business_date >= todayStr()) {
    return {
      needsConfirm: true,
      message: 'يوجد يوم عمل مفتوح بالفعل لهذا اليوم — هل تريد بدء يوم جديد وإعادة الترقيم من 1؟'
    }
  }
  return { needsConfirm: false }
}

export function startNewDay(userId: number): WorkSession {
  const open = getOpenSession()
  const tx = getDb().transaction(() => {
    if (open) closeSession(open.id)
    return openNewSession(userId)
  })
  return tx()
}

export function getSessionsForDate(date: string): WorkSession[] {
  return getDb()
    .prepare('SELECT * FROM work_sessions WHERE business_date = ? ORDER BY id')
    .all(date) as WorkSession[]
}
