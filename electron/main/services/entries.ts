import { getDb } from '../db'
import type { Entry, EntryView } from '../../shared/types'
import { ensureActiveSession } from './sessions'

/**
 * Records one button press. Allocates the next client number (seq_no) within
 * the active work session inside a single transaction so numbers stay unique
 * and gap-free across all service types.
 */
export function createEntry(input: { type_id: number; user_id: number }): Entry {
  const db = getDb()
  const tx = db.transaction(() => {
    const session = ensureActiveSession(input.user_id)
    const type = db
      .prepare('SELECT id, name, price FROM service_types WHERE id = ?')
      .get(input.type_id) as { id: number; name: string; price: number } | undefined
    if (!type) throw new Error('الخدمة غير موجودة')

    const next = db
      .prepare('SELECT COALESCE(MAX(seq_no), 0) + 1 AS n FROM entries WHERE session_id = ?')
      .get(session.id) as { n: number }

    const info = db
      .prepare(
        `INSERT INTO entries (session_id, seq_no, type_id, type_name_snapshot, price_snapshot, user_id)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(session.id, next.n, type.id, type.name, type.price, input.user_id)

    return db.prepare('SELECT * FROM entries WHERE id = ?').get(info.lastInsertRowid) as Entry
  })
  return tx()
}

export function getEntry(id: number): Entry | undefined {
  return getDb().prepare('SELECT * FROM entries WHERE id = ?').get(id) as Entry | undefined
}

/** Entries for the current active session (today's running list). */
export function getActiveSessionEntries(): EntryView[] {
  const session = getDb()
    .prepare('SELECT id FROM work_sessions WHERE closed_at IS NULL ORDER BY id DESC LIMIT 1')
    .get() as { id: number } | undefined
  if (!session) return []
  return getDb()
    .prepare(
      `SELECT e.*, u.display_name AS user_name
       FROM entries e JOIN users u ON u.id = e.user_id
       WHERE e.session_id = ? ORDER BY e.seq_no DESC`
    )
    .all(session.id) as EntryView[]
}
