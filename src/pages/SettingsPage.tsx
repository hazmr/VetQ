import { useEffect, useState } from 'react'
import { api, call } from '../api'
import type { ServiceType, Settings } from '../../electron/shared/types'
import { useI18n, LangToggle } from '../i18n'
import { ThemeToggle } from '../theme'

export function SettingsPage({ onChange }: { onChange: (s: Settings) => void }) {
  const { t: tr } = useI18n()
  const [types, setTypes] = useState<ServiceType[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [printers, setPrinters] = useState<{ name: string; displayName: string }[]>([])
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  // new type form
  const [newName, setNewName] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [newColor, setNewColor] = useState('#555555')

  const refresh = async () => {
    const [t, s, p] = await Promise.all([
      call(api.types.list(true)),
      call(api.settings.get()),
      call(api.settings.printers()).catch(() => [])
    ])
    setTypes(t)
    setSettings(s)
    setPrinters(p)
  }

  useEffect(() => {
    void refresh()
  }, [])

  const flash = (m: string) => {
    setMsg(m)
    setTimeout(() => setMsg(''), 1800)
  }

  const addType = async () => {
    setError('')
    try {
      await call(api.types.create({ name: newName, price: parseFloat(newPrice) || 0, color: newColor }))
      setNewName('')
      setNewPrice('')
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('common.error'))
    }
  }

  const patchType = async (id: number, patch: Partial<ServiceType>) => {
    await call(api.types.update(id, patch))
    await refresh()
  }

  const saveSettings = async (patch: Partial<Settings>) => {
    const s = await call(api.settings.update(patch))
    setSettings(s)
    onChange(s)
    flash(tr('common.saved'))
  }

  if (!settings) return null

  return (
    <>
      <h1 className="page-title">{tr('nav.settings')}</h1>
      {error && <div className="error-banner" style={{ marginBottom: 14 }}>{error}</div>}
      {msg && <div className="badge" style={{ marginBottom: 14 }}>{msg}</div>}

      <div className="grid" style={{ gridTemplateColumns: '1fr', gap: 22 }}>
        {/* Service types */}
        <div className="card">
          <h2 style={{ marginBottom: 16 }}>{tr('settings.servicesHeading')}</h2>
          <table className="tbl">
            <thead>
              <tr>
                <th>{tr('common.color')}</th>
                <th>{tr('common.name')}</th>
                <th>{tr('common.price')}</th>
                <th>{tr('common.status')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {types.map((t) => (
                <tr key={t.id}>
                  <td>
                    <input
                      type="color"
                      defaultValue={t.color}
                      style={{ width: 44, height: 34, padding: 2 }}
                      onBlur={(e) => e.target.value !== t.color && patchType(t.id, { color: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      defaultValue={t.name}
                      onBlur={(e) => e.target.value.trim() && e.target.value !== t.name && patchType(t.id, { name: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      defaultValue={t.price}
                      style={{ width: 110 }}
                      onBlur={(e) => parseFloat(e.target.value) !== t.price && patchType(t.id, { price: parseFloat(e.target.value) || 0 })}
                    />
                  </td>
                  <td>
                    <span className="badge">{t.active ? tr('common.enabled') : tr('common.disabled')}</span>
                  </td>
                  <td>
                    <button className="btn ghost sm" onClick={() => patchType(t.id, { active: t.active ? 0 : 1 })}>
                      {t.active ? tr('common.disable') : tr('common.enable')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="row" style={{ marginTop: 18, alignItems: 'flex-end' }}>
            <label className="field" style={{ flex: 2 }}>
              {tr('settings.newServiceName')}
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={tr('settings.newServicePlaceholder')} />
            </label>
            <label className="field" style={{ flex: 1 }}>
              {tr('common.price')}
              <input type="number" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} placeholder="0" />
            </label>
            <label className="field">
              {tr('common.color')}
              <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} style={{ width: 56, height: 44 }} />
            </label>
            <button className="btn" disabled={!newName.trim()} onClick={addType}>
              {tr('common.add')}
            </button>
          </div>
        </div>

        {/* General */}
        <div className="card">
          <h2 style={{ marginBottom: 16 }}>{tr('settings.generalHeading')}</h2>
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <label className="field" style={{ flex: 2 }}>
              {tr('settings.clinicName')}
              <input
                type="text"
                defaultValue={settings.clinic_name}
                onBlur={(e) => e.target.value !== settings.clinic_name && saveSettings({ clinic_name: e.target.value })}
              />
            </label>
            <label className="field">
              {tr('settings.currency')}
              <input
                type="text"
                defaultValue={settings.currency}
                style={{ width: 90 }}
                onBlur={(e) => e.target.value !== settings.currency && saveSettings({ currency: e.target.value })}
              />
            </label>
          </div>
        </div>

        {/* Printing */}
        <div className="card">
          <h2 style={{ marginBottom: 16 }}>{tr('settings.printingHeading')}</h2>
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <label className="field" style={{ flex: 2 }}>
              {tr('settings.printer')}
              <select
                defaultValue={settings.printer_name}
                onChange={(e) => saveSettings({ printer_name: e.target.value })}
              >
                <option value="">{tr('settings.defaultPrinter')}</option>
                {printers.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="theme-toggle" style={{ flex: 1 }}>
              <span>{tr('settings.autoPrint')}</span>
              <input
                type="checkbox"
                checked={settings.auto_print}
                onChange={(e) => saveSettings({ auto_print: e.target.checked })}
              />
            </label>
          </div>
        </div>

        {/* Appearance & language */}
        <div className="card">
          <h2 style={{ marginBottom: 16 }}>{tr('settings.appearanceHeading')}</h2>
          <div className="row" style={{ alignItems: 'stretch' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <LangToggle />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
