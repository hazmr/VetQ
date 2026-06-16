// Shared types used by both the main process and the renderer.

export type Role = 'admin' | 'user'

export interface User {
  id: number
  username: string
  role: Role
  display_name: string
  active: number
  created_at: string
}

export interface ServiceType {
  id: number
  name: string
  price: number
  color: string
  sort_order: number
  active: number
  created_at: string
}

export interface WorkSession {
  id: number
  opened_at: string
  opened_by: number
  closed_at: string | null
  business_date: string // YYYY-MM-DD
}

export interface Entry {
  id: number
  session_id: number
  seq_no: number
  type_id: number
  type_name_snapshot: string
  price_snapshot: number
  user_id: number
  created_at: string
}

export interface EntryView extends Entry {
  user_name: string
}

export interface CreateEntryResult {
  entry: Entry
  printed: boolean
  printError?: string
  /** Set when no printer was available and the ticket was saved as a PDF instead. */
  pdfPath?: string
}

export interface PrintResult {
  /** 'printer' = sent silently to a printer; 'pdf' = no printer, saved as a PDF file. */
  method: 'printer' | 'pdf'
  printer?: string
  pdfPath?: string
}

export interface DailyReport {
  date: string
  sessions: number
  perType: { type_id: number; name: string; count: number; revenue: number }[]
  perUser: { user_id: number; name: string; count: number; revenue: number }[]
  totalCount: number
  totalRevenue: number
  entries: EntryView[]
}

export interface MonthlyReport {
  month: string // YYYY-MM
  perDay: { date: string; count: number; revenue: number }[]
  perType: { type_id: number; name: string; count: number; revenue: number }[]
  totalCount: number
  totalRevenue: number
}

export interface RangeReport {
  from: string // YYYY-MM-DD
  to: string // YYYY-MM-DD
  sessions: number
  totalCount: number
  totalRevenue: number
  perType: { type_id: number; name: string; count: number; revenue: number }[]
  perUser: { user_id: number; name: string; count: number; revenue: number }[]
  perDay: { date: string; count: number; revenue: number }[]
  perHour: { hour: number; count: number; revenue: number }[]
  // Same-length period immediately before [from,to], for comparison.
  prevFrom: string
  prevTo: string
  prevTotalCount: number
  prevTotalRevenue: number
}

export interface Settings {
  theme: 'light' | 'dark'
  lang: 'ar' | 'en'
  clinic_name: string
  currency: string
  printer_name: string
  auto_print: boolean
  backup_dir: string
  auto_backup: boolean
  backup_retention: number
}

export interface DbInfo {
  dbPath: string
  sizeBytes: number
  integrity: string // 'ok' when healthy
  users: number
  services: number
  sessions: number
  entries: number
  firstDate: string | null
  lastDate: string | null
}

export interface StartDayCheck {
  needsConfirm: boolean
  message?: string
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string }
