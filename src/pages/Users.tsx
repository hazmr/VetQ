import { useEffect, useState } from 'react'
import { api, call } from '../api'
import type { Role, User } from '../../electron/shared/types'
import { useI18n } from '../i18n'

export function Users({ currentUserId }: { currentUserId: number }) {
  const { t } = useI18n()
  const [users, setUsers] = useState<User[]>([])
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('user')

  const [resetTarget, setResetTarget] = useState<User | null>(null)
  const [newPw, setNewPw] = useState('')

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2000) }

  const refresh = async () => setUsers(await call(api.users.list()))
  useEffect(() => {
    void refresh()
  }, [])

  const add = async () => {
    setError('')
    try {
      await call(api.users.create({ username, password, role, display_name: displayName }))
      setUsername('')
      setDisplayName('')
      setPassword('')
      setRole('user')
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    }
  }

  const toggle = async (u: User) => {
    setError('')
    try {
      await call(api.users.setActive(u.id, !u.active))
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    }
  }

  const confirmResetPw = async () => {
    if (!resetTarget || !newPw) return
    setError('')
    try {
      await call(api.users.resetPassword(resetTarget.id, newPw))
      setResetTarget(null)
      setNewPw('')
      flash(t('users.passwordChanged'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    }
  }

  return (
    <>
      <h1 className="page-title">{t('nav.users')}</h1>
      {error && <div className="error-banner" style={{ marginBottom: 14 }}>{error}</div>}
      {msg && <div className="badge" style={{ marginBottom: 14 }}>{msg}</div>}

      <div className="card" style={{ marginBottom: 22 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>{t('common.name')}</th>
              <th>{t('common.username')}</th>
              <th>{t('common.role')}</th>
              <th>{t('common.status')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.display_name}</td>
                <td>{u.username}</td>
                <td>
                  <span className="badge">{u.role === 'admin' ? t('common.admin') : t('common.user')}</span>
                </td>
                <td>
                  <span className="badge">{u.active ? t('common.enabled') : t('common.disabled')}</span>
                </td>
                <td>
                  {resetTarget?.id === u.id ? (
                    <div className="row">
                      <input
                        type="password"
                        autoFocus
                        value={newPw}
                        onChange={(e) => setNewPw(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') void confirmResetPw(); if (e.key === 'Escape') { setResetTarget(null); setNewPw('') } }}
                        placeholder={t('common.password')}
                        style={{ width: 140 }}
                      />
                      <button className="btn sm" disabled={!newPw} onClick={() => void confirmResetPw()}>{t('common.save')}</button>
                      <button className="btn ghost sm" onClick={() => { setResetTarget(null); setNewPw('') }}>{t('common.cancel')}</button>
                    </div>
                  ) : (
                    <div className="row">
                      <button className="btn ghost sm" onClick={() => { setResetTarget(u); setNewPw('') }}>
                        {t('users.resetPassword')}
                      </button>
                      {u.id !== currentUserId && (
                        <button className="btn ghost sm" onClick={() => toggle(u)}>
                          {u.active ? t('common.disable') : t('common.enable')}
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 16 }}>{t('users.addUser')}</h2>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <label className="field">
            {t('users.displayName')}
            <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </label>
          <label className="field">
            {t('common.username')}
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>
          <label className="field">
            {t('common.password')}
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <label className="field">
            {t('common.role')}
            <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="user">{t('common.user')}</option>
              <option value="admin">{t('common.admin')}</option>
            </select>
          </label>
          <button className="btn" disabled={!username || !password} onClick={add}>
            {t('common.add')}
          </button>
        </div>
      </div>
    </>
  )
}
