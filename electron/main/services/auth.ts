import bcrypt from 'bcryptjs'
import { getDb } from '../db'
import type { Role, User } from '../../shared/types'

function rowToUser(row: any): User {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    display_name: row.display_name,
    active: row.active,
    created_at: row.created_at
  }
}

export function hasAdmin(): boolean {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'")
    .get() as { c: number }
  return row.c > 0
}

export function isFirstRun(): boolean {
  const row = getDb().prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }
  return row.c === 0
}

export function createUser(input: {
  username: string
  password: string
  role: Role
  display_name?: string
}): User {
  const username = input.username.trim()
  if (!username) throw new Error('اسم المستخدم مطلوب')
  if (!input.password || input.password.length < 4)
    throw new Error('كلمة المرور يجب أن تكون 4 أحرف على الأقل')

  const exists = getDb().prepare('SELECT id FROM users WHERE username = ?').get(username)
  if (exists) throw new Error('اسم المستخدم موجود بالفعل')

  const hash = bcrypt.hashSync(input.password, 10)
  const info = getDb()
    .prepare(
      'INSERT INTO users (username, password_hash, role, display_name) VALUES (?, ?, ?, ?)'
    )
    .run(username, hash, input.role, input.display_name?.trim() || username)
  return getUserById(Number(info.lastInsertRowid))!
}

export function login(username: string, password: string): User {
  const row = getDb()
    .prepare('SELECT * FROM users WHERE username = ? AND active = 1')
    .get(username.trim()) as any
  if (!row) throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة')
  if (!bcrypt.compareSync(password, row.password_hash))
    throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة')
  return rowToUser(row)
}

export function getUserById(id: number): User | undefined {
  const row = getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as any
  return row ? rowToUser(row) : undefined
}

export function listUsers(): User[] {
  const rows = getDb()
    .prepare("SELECT * FROM users ORDER BY role = 'admin' DESC, username")
    .all() as any[]
  return rows.map(rowToUser)
}

export function setUserActive(id: number, active: boolean): void {
  const user = getUserById(id)
  if (!user) throw new Error('المستخدم غير موجود')
  if (user.role === 'admin' && !active) {
    const row = getDb()
      .prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND active = 1")
      .get() as { c: number }
    if (row.c <= 1) throw new Error('لا يمكن تعطيل آخر مدير')
  }
  getDb().prepare('UPDATE users SET active = ? WHERE id = ?').run(active ? 1 : 0, id)
}

export function resetPassword(id: number, password: string): void {
  if (!password || password.length < 4)
    throw new Error('كلمة المرور يجب أن تكون 4 أحرف على الأقل')
  const hash = bcrypt.hashSync(password, 10)
  getDb().prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, id)
}
