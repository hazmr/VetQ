import { useEffect, useState } from 'react'
import { api, call } from '../api'
import type { CreateEntryResult, EntryView, ServiceType, Settings } from '../../electron/shared/types'
import { useI18n } from '../i18n'

export function Counter({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useI18n()
  const [types, setTypes] = useState<ServiceType[]>([])
  const [entries, setEntries] = useState<EntryView[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [toast, setToast] = useState<CreateEntryResult | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [newDayConfirm, setNewDayConfirm] = useState<string | null>(null)

  const baseName = (p: string) => p.split(/[\\/]/).pop() ?? p

  const refresh = async () => {
    const [t, e, s] = await Promise.all([
      call(api.types.list()),
      call(api.entries.active()),
      call(api.settings.get())
    ])
    setTypes(t)
    setEntries(e)
    setSettings(s)
  }

  useEffect(() => {
    void refresh()
  }, [])

  const press = async (typeId: number) => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const res = await call(api.entries.create(typeId))
      setToast(res)
      await refresh()
      setTimeout(() => setToast(null), 2200)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setBusy(false)
    }
  }

  const startNewDay = async () => {
    setError('')
    const check = await call(api.session.checkNewDay())
    if (check.needsConfirm) {
      setNewDayConfirm(check.message || t('counter.confirmNewDay'))
      return
    }
    await call(api.session.startNewDay())
    await refresh()
  }

  const confirmNewDay = async () => {
    setNewDayConfirm(null)
    setError('')
    await call(api.session.startNewDay())
    await refresh()
  }

  const reprint = async (id: number) => {
    setNotice('')
    try {
      const res = await call(api.entries.print(id))
      if (res.method === 'pdf' && res.pdfPath) {
        setNotice(t('counter.savedPdf', { file: baseName(res.pdfPath) }))
        setTimeout(() => setNotice(''), 4000)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('counter.printFailed'))
    }
  }

  const currency = settings?.currency ?? ''
  const total = entries.reduce((s, e) => s + e.price_snapshot, 0)

  return (
    <>
      <div className="row" style={{ marginBottom: 18 }}>
        <h1 className="page-title" style={{ margin: 0 }}>
          {t('nav.counter')}
        </h1>
        <div className="spacer" />
        <button className="btn ghost" onClick={startNewDay}>
          {t('counter.newDay')}
        </button>
      </div>

      {error && <div className="error-banner" style={{ marginBottom: 14 }}>{error}</div>}
      {notice && <div className="badge" style={{ marginBottom: 14 }}>{notice}</div>}
      {newDayConfirm && (
        <div className="error-banner" style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ flex: 1 }}>{newDayConfirm}</span>
          <button className="btn sm" onClick={() => void confirmNewDay()}>{t('common.confirm')}</button>
          <button className="btn ghost sm" onClick={() => setNewDayConfirm(null)}>{t('common.cancel')}</button>
        </div>
      )}

      <div className="counter-layout">
        <div className="btn-grid">
          {types.length === 0 && (
            <div className="muted" style={{ gridColumn: '1 / -1' }}>
              {isAdmin ? t('counter.noServicesAdmin') : t('counter.noServicesUser')}
            </div>
          )}
          {types.map((t) => (
            <button key={t.id} className="service-btn" onClick={() => press(t.id)} disabled={busy}>
              <span className="dot" style={{ background: t.color }} />
              <span className="name">{t.name}</span>
              <span className="price">
                {t.price} {currency}
              </span>
            </button>
          ))}
        </div>

        <div className="side-panel">
          <div className="side-head">
            <div className="row">
              <strong>{t('counter.todayClients')}</strong>
              <div className="spacer" />
              <span className="badge">{t('counter.clientsBadge', { n: entries.length })}</span>
            </div>
            <div className="muted" style={{ marginTop: 6 }}>
              {t('counter.total', { amount: total, currency })}
            </div>
          </div>
          <div className="entry-list">
            {entries.map((e) => (
              <div className="entry-row" key={e.id}>
                <span className="entry-seq">{e.seq_no}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{e.type_name_snapshot}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {e.price_snapshot} {currency} · {e.created_at.slice(11, 16)} · {e.user_name}
                  </div>
                </div>
                <button className="btn ghost sm" onClick={() => reprint(e.id)}>
                  🖨️
                </button>
              </div>
            ))}
            {entries.length === 0 && (
              <div className="muted" style={{ padding: 18 }}>
                {t('counter.noClients')}
              </div>
            )}
          </div>
        </div>
      </div>

      {toast && (
        <div className="toast" onClick={() => setToast(null)}>
          <div className="toast-card">
            <div className="muted">{t('counter.clientNumber')}</div>
            <div className="big">{toast.entry.seq_no}</div>
            <div className="sub">{toast.entry.type_name_snapshot}</div>
            <div className="muted" style={{ marginTop: 6 }}>
              {toast.entry.price_snapshot} {currency}
            </div>
            {settings?.auto_print && toast.pdfPath && (
              <div className="warn">{t('counter.savedPdf', { file: baseName(toast.pdfPath) })}</div>
            )}
            {settings?.auto_print && !toast.printed && !toast.pdfPath && toast.printError && (
              <div className="warn">{t('counter.printFailedReason', { reason: toast.printError })}</div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
