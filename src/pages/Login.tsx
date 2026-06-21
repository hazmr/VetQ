import { useRef, useEffect, useState } from 'react'
import { api, call } from '../api'
import type { User } from '../../electron/shared/types'
import { ThemeToggle } from '../theme'
import { useI18n, LangToggle } from '../i18n'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
}

export function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const { t } = useI18n()
  const [users, setUsers] = useState<{ username: string; display_name: string }[]>([])
  const [loaded, setLoaded] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const passwordRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void (async () => {
      try {
        const list = await call(api.auth.loginUsers())
        setUsers(list)
        if (list.length) setUsername(list[0].username)
      } catch {
        /* fall back to manual entry */
      } finally {
        setLoaded(true)
      }
    })()
  }, [])

  const pick = (name: string) => {
    setUsername(name)
    setError('')
    setTimeout(() => passwordRef.current?.focus(), 0)
  }

  const submit = async () => {
    if (!username || !password || busy) return
    setError('')
    setBusy(true)
    try {
      const u = await call(api.auth.login({ username, password }))
      onLogin(u)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>🐾 VetQ</h1>
        <p className="sub">{t('login.subtitle')}</p>
        {error && <div className="error-banner">{error}</div>}

        {loaded && users.length > 0 ? (
          <div className="field">
            <span>{t('login.chooseUser')}</span>
            <div className="login-users">
              {users.map((u) => (
                <button
                  type="button"
                  key={u.username}
                  className={'login-user' + (username === u.username ? ' selected' : '')}
                  onClick={() => pick(u.username)}
                >
                  <span className="login-avatar">{initials(u.display_name)}</span>
                  <span className="login-user-name">{u.display_name}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <label className="field">
            {t('common.username')}
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
          </label>
        )}

        <label className="field">
          {t('common.password')}
          <input
            ref={passwordRef}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </label>

        <button className="btn btn-lg" disabled={busy || !username || !password} onClick={submit}>
          {busy ? t('login.signingIn') : t('login.submit')}
        </button>

        <div className="auth-footer">
          <LangToggle />
          <ThemeToggle />
        </div>
      </div>
    </div>
  )
}
