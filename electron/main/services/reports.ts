import { getDb } from '../db'
import type { DailyReport, EntryView, MonthlyReport, RangeReport } from '../../shared/types'

export function dailyReport(date: string): DailyReport {
  const db = getDb()
  const sessions = db
    .prepare('SELECT id FROM work_sessions WHERE business_date = ?')
    .all(date) as { id: number }[]
  const ids = sessions.map((s) => s.id)

  const empty: DailyReport = {
    date,
    sessions: 0,
    perType: [],
    perUser: [],
    totalCount: 0,
    totalRevenue: 0,
    entries: []
  }
  if (!ids.length) return empty
  const placeholders = ids.map(() => '?').join(',')

  const perType = db
    .prepare(
      `SELECT type_id, type_name_snapshot AS name, COUNT(*) AS count, SUM(price_snapshot) AS revenue
       FROM entries WHERE session_id IN (${placeholders})
       GROUP BY type_id, type_name_snapshot ORDER BY revenue DESC`
    )
    .all(...ids) as DailyReport['perType']

  const perUser = db
    .prepare(
      `SELECT e.user_id, u.display_name AS name, COUNT(*) AS count, SUM(e.price_snapshot) AS revenue
       FROM entries e JOIN users u ON u.id = e.user_id
       WHERE e.session_id IN (${placeholders}) GROUP BY e.user_id, u.display_name ORDER BY revenue DESC`
    )
    .all(...ids) as DailyReport['perUser']

  const entries = db
    .prepare(
      `SELECT e.*, u.display_name AS user_name FROM entries e JOIN users u ON u.id = e.user_id
       WHERE e.session_id IN (${placeholders}) ORDER BY e.created_at`
    )
    .all(...ids) as EntryView[]

  const totalCount = entries.length
  const totalRevenue = entries.reduce((s, e) => s + e.price_snapshot, 0)

  return {
    date,
    sessions: ids.length,
    perType,
    perUser,
    totalCount,
    totalRevenue,
    entries
  }
}

export function monthlyReport(month: string): MonthlyReport {
  const db = getDb()
  // month = YYYY-MM
  const perDay = db
    .prepare(
      `SELECT ws.business_date AS date, COUNT(e.id) AS count, COALESCE(SUM(e.price_snapshot),0) AS revenue
       FROM work_sessions ws LEFT JOIN entries e ON e.session_id = ws.id
       WHERE substr(ws.business_date, 1, 7) = ?
       GROUP BY ws.business_date ORDER BY ws.business_date`
    )
    .all(month) as MonthlyReport['perDay']

  const perType = db
    .prepare(
      `SELECT e.type_id, e.type_name_snapshot AS name, COUNT(*) AS count, SUM(e.price_snapshot) AS revenue
       FROM entries e JOIN work_sessions ws ON ws.id = e.session_id
       WHERE substr(ws.business_date, 1, 7) = ?
       GROUP BY e.type_id, e.type_name_snapshot ORDER BY revenue DESC`
    )
    .all(month) as MonthlyReport['perType']

  const totalCount = perDay.reduce((s, d) => s + d.count, 0)
  const totalRevenue = perDay.reduce((s, d) => s + d.revenue, 0)

  return { month, perDay, perType, totalCount, totalRevenue }
}

// ---------- custom date range (advanced report) ----------

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** The same-length period ending the day before `from`. */
function previousPeriod(from: string, to: string): { prevFrom: string; prevTo: string } {
  const f = new Date(from + 'T00:00:00')
  const t = new Date(to + 'T00:00:00')
  const days = Math.max(1, Math.round((t.getTime() - f.getTime()) / 86400000) + 1)
  const prevTo = new Date(f.getTime() - 86400000)
  const prevFrom = new Date(prevTo.getTime() - (days - 1) * 86400000)
  return { prevFrom: isoDate(prevFrom), prevTo: isoDate(prevTo) }
}

function rangeTotals(from: string, to: string): { count: number; revenue: number } {
  const row = getDb()
    .prepare(
      `SELECT COUNT(e.id) AS count, COALESCE(SUM(e.price_snapshot), 0) AS revenue
       FROM entries e JOIN work_sessions ws ON ws.id = e.session_id
       WHERE ws.business_date BETWEEN ? AND ?`
    )
    .get(from, to) as { count: number; revenue: number }
  return row
}

export function rangeReport(from: string, to: string): RangeReport {
  const db = getDb()

  const perDay = db
    .prepare(
      `SELECT ws.business_date AS date, COUNT(e.id) AS count, COALESCE(SUM(e.price_snapshot), 0) AS revenue
       FROM work_sessions ws LEFT JOIN entries e ON e.session_id = ws.id
       WHERE ws.business_date BETWEEN ? AND ?
       GROUP BY ws.business_date ORDER BY ws.business_date`
    )
    .all(from, to) as RangeReport['perDay']

  const perType = db
    .prepare(
      `SELECT e.type_id, e.type_name_snapshot AS name, COUNT(*) AS count, SUM(e.price_snapshot) AS revenue
       FROM entries e JOIN work_sessions ws ON ws.id = e.session_id
       WHERE ws.business_date BETWEEN ? AND ?
       GROUP BY e.type_id, e.type_name_snapshot ORDER BY revenue DESC`
    )
    .all(from, to) as RangeReport['perType']

  const perUser = db
    .prepare(
      `SELECT e.user_id, u.display_name AS name, COUNT(*) AS count, SUM(e.price_snapshot) AS revenue
       FROM entries e JOIN work_sessions ws ON ws.id = e.session_id JOIN users u ON u.id = e.user_id
       WHERE ws.business_date BETWEEN ? AND ?
       GROUP BY e.user_id, u.display_name ORDER BY revenue DESC`
    )
    .all(from, to) as RangeReport['perUser']

  const perHour = db
    .prepare(
      `SELECT CAST(substr(e.created_at, 12, 2) AS INTEGER) AS hour, COUNT(*) AS count, SUM(e.price_snapshot) AS revenue
       FROM entries e JOIN work_sessions ws ON ws.id = e.session_id
       WHERE ws.business_date BETWEEN ? AND ?
       GROUP BY hour ORDER BY hour`
    )
    .all(from, to) as RangeReport['perHour']

  const sessions = (
    db
      .prepare('SELECT COUNT(*) AS c FROM work_sessions WHERE business_date BETWEEN ? AND ?')
      .get(from, to) as { c: number }
  ).c

  const totalCount = perDay.reduce((s, d) => s + d.count, 0)
  const totalRevenue = perDay.reduce((s, d) => s + d.revenue, 0)

  const { prevFrom, prevTo } = previousPeriod(from, to)
  const prev = rangeTotals(prevFrom, prevTo)

  return {
    from,
    to,
    sessions,
    totalCount,
    totalRevenue,
    perType,
    perUser,
    perDay,
    perHour,
    prevFrom,
    prevTo,
    prevTotalCount: prev.count,
    prevTotalRevenue: prev.revenue
  }
}
