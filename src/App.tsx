import { useEffect, useState, type ReactNode } from 'react'
import { api, call } from './api'
import type { Settings, User } from '../electron/shared/types'
import { ThemeProvider, ThemeToggle } from './theme'
import { LangProvider, LangToggle, useI18n } from './i18n'
import { Setup } from './pages/Setup'
import { Login } from './pages/Login'
import { Counter } from './pages/Counter'
import { Reports } from './pages/Reports'
import { SettingsPage } from './pages/SettingsPage'
import { Users } from './pages/Users'
import { Backups } from './pages/Backups'

type Page = 'counter' | 'reports' | 'settings' | 'users' | 'backups'

function Shell({
  theme,
  lang,
  children
}: {
  theme: 'light' | 'dark'
  lang: 'ar' | 'en'
  children: ReactNode
}) {
  return (
    <LangProvider initial={lang}>
      <ThemeProvider initial={theme}>{children}</ThemeProvider>
    </LangProvider>
  )
}

export function App() {
  const [loading, setLoading] = useState(true)
  const [firstRun, setFirstRun] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [page, setPage] = useState<Page>('counter')

  const boot = async () => {
    const [state, s] = await Promise.all([call(api.auth.state()), call(api.settings.get())])
    setFirstRun(state.firstRun)
    setUser(state.user)
    setSettings(s)
    setLoading(false)
  }

  useEffect(() => {
    void boot()
  }, [])

  if (loading) return null

  const initialTheme = settings?.theme ?? 'light'
  const initialLang = settings?.lang ?? 'ar'

  if (firstRun) {
    return (
      <Shell theme={initialTheme} lang={initialLang}>
        <Setup
          onDone={(u) => {
            setFirstRun(false)
            setUser(u)
          }}
        />
      </Shell>
    )
  }

  if (!user) {
    return (
      <Shell theme={initialTheme} lang={initialLang}>
        <Login onLogin={setUser} />
      </Shell>
    )
  }

  const logout = async () => {
    await call(api.auth.logout())
    setUser(null)
    setPage('counter')
  }

  return (
    <Shell theme={initialTheme} lang={initialLang}>
      <MainLayout
        user={user}
        page={page}
        setPage={setPage}
        logout={logout}
        onSettingsChange={(s) => setSettings(s)}
      />
    </Shell>
  )
}

function MainLayout({
  user,
  page,
  setPage,
  logout,
  onSettingsChange
}: {
  user: User
  page: Page
  setPage: (p: Page) => void
  logout: () => void
  onSettingsChange: (s: Settings) => void
}) {
  const { t } = useI18n()
  const isAdmin = user.role === 'admin'

  const nav: { id: Page; label: string; adminOnly: boolean }[] = [
    { id: 'counter', label: t('nav.counter'), adminOnly: false },
    { id: 'reports', label: t('nav.reports'), adminOnly: true },
    { id: 'settings', label: t('nav.settings'), adminOnly: true },
    { id: 'users', label: t('nav.users'), adminOnly: true },
    { id: 'backups', label: t('nav.backups'), adminOnly: true }
  ]
  const visible = nav.filter((n) => !n.adminOnly || isAdmin)

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">🐾 VetQ</div>
        {visible.map((n) => (
          <button
            key={n.id}
            className={'nav-item' + (page === n.id ? ' active' : '')}
            onClick={() => setPage(n.id)}
          >
            {n.label}
          </button>
        ))}
        <div className="sidebar-footer">
          <LangToggle />
          <ThemeToggle />
          <div className="theme-toggle" style={{ background: 'transparent' }}>
            <span>{user.display_name}</span>
            <span className="badge">{isAdmin ? t('common.admin') : t('common.user')}</span>
          </div>
          <button className="btn ghost" onClick={logout}>
            {t('common.logout')}
          </button>
        </div>
      </aside>
      <main className="content">
        {page === 'counter' && <Counter isAdmin={isAdmin} />}
        {page === 'reports' && isAdmin && <Reports />}
        {page === 'settings' && isAdmin && <SettingsPage onChange={onSettingsChange} />}
        {page === 'users' && isAdmin && <Users currentUserId={user.id} />}
        {page === 'backups' && isAdmin && <Backups onRestored={logout} />}
      </main>
    </div>
  )
}
