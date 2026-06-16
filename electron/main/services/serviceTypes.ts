import { getDb } from '../db'
import type { ServiceType } from '../../shared/types'

export function listServiceTypes(includeInactive = false): ServiceType[] {
  const where = includeInactive ? '' : 'WHERE active = 1'
  return getDb()
    .prepare(`SELECT * FROM service_types ${where} ORDER BY sort_order, id`)
    .all() as ServiceType[]
}

export function createServiceType(input: {
  name: string
  price: number
  color?: string
}): ServiceType {
  const name = input.name.trim()
  if (!name) throw new Error('اسم الخدمة مطلوب')
  const max = getDb()
    .prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM service_types')
    .get() as { m: number }
  const info = getDb()
    .prepare(
      'INSERT INTO service_types (name, price, color, sort_order) VALUES (?, ?, ?, ?)'
    )
    .run(name, input.price || 0, input.color || '#555555', max.m + 1)
  return getDb()
    .prepare('SELECT * FROM service_types WHERE id = ?')
    .get(info.lastInsertRowid) as ServiceType
}

export function updateServiceType(
  id: number,
  patch: Partial<Pick<ServiceType, 'name' | 'price' | 'color' | 'sort_order' | 'active'>>
): void {
  const fields: string[] = []
  const values: any[] = []
  for (const [k, v] of Object.entries(patch)) {
    fields.push(`${k} = ?`)
    values.push(k === 'name' && typeof v === 'string' ? v.trim() : v)
  }
  if (!fields.length) return
  values.push(id)
  getDb()
    .prepare(`UPDATE service_types SET ${fields.join(', ')} WHERE id = ?`)
    .run(...values)
}

export function reorderServiceTypes(orderedIds: number[]): void {
  const stmt = getDb().prepare('UPDATE service_types SET sort_order = ? WHERE id = ?')
  const tx = getDb().transaction(() => {
    orderedIds.forEach((id, i) => stmt.run(i + 1, id))
  })
  tx()
}
