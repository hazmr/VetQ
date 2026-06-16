import { getDb } from './index'
import type { Settings } from '../../shared/types'

export function getAllSettings(): Settings {
  const rows = getDb().prepare('SELECT key, value FROM settings').all() as {
    key: string
    value: string
  }[]
  const map = new Map(rows.map((r) => [r.key, r.value]))
  return {
    theme: (map.get('theme') as 'light' | 'dark') ?? 'light',
    lang: (map.get('lang') as 'ar' | 'en') ?? 'ar',
    clinic_name: map.get('clinic_name') ?? '',
    currency: map.get('currency') ?? 'ج.م',
    printer_name: map.get('printer_name') ?? '',
    auto_print: map.get('auto_print') === '1',
    backup_dir: map.get('backup_dir') ?? '',
    auto_backup: map.get('auto_backup') === '1',
    backup_retention: parseInt(map.get('backup_retention') ?? '30', 10)
  }
}

export function getSetting(key: string): string | undefined {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value
}

export function setSetting(key: string, value: string): void {
  getDb()
    .prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    )
    .run(key, value)
}

export function updateSettings(partial: Partial<Record<keyof Settings, string>>): void {
  const tx = getDb().transaction(() => {
    for (const [k, v] of Object.entries(partial)) setSetting(k, String(v))
  })
  tx()
}
