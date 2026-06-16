import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, call } from './api'
import { useI18n } from './i18n'

type Theme = 'light' | 'dark'

const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({
  theme: 'light',
  toggle: () => {}
})

export function ThemeProvider({ children, initial }: { children: ReactNode; initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggle = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    void call(api.settings.update({ theme: next })).catch(() => {})
  }

  return <ThemeCtx.Provider value={{ theme, toggle }}>{children}</ThemeCtx.Provider>
}

export const useTheme = () => useContext(ThemeCtx)

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const { t } = useI18n()
  return (
    <button className="theme-toggle" onClick={toggle} style={{ border: '1px solid var(--border)', width: '100%' }}>
      <span>{theme === 'light' ? t('theme.darkMode') : t('theme.lightMode')}</span>
      <span className="badge">{theme === 'light' ? t('theme.light') : t('theme.dark')}</span>
    </button>
  )
}
