import { useState } from 'react'
import { api, call } from '../api'
import type { User } from '../../electron/shared/types'
import { ThemeToggle } from '../theme'
import { useI18n, LangToggle } from '../i18n'

export function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const { t } = useI18n()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
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
        <label className="field">
          {t('common.username')}
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
        </label>
        <label className="field">
          {t('common.password')}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </label>
        <button className="btn" disabled={busy || !username || !password} onClick={submit}>
          {t('login.submit')}
        </button>
        <LangToggle />
        <ThemeToggle />
      </div>
    </div>
  )
}
