import { useEffect, useState } from 'react'
import { api, call } from '../api'
import type { DbInfo, Settings } from '../../electron/shared/types'
import { useI18n, localeFor } from '../i18n'

function fmtSize(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

export function Backups({ onRestored }: { onRestored: () => void }) {
  const { t, lang } = useI18n()
  const [list, setList] = useState<{ file: string; path: string; size: number; mtime: number }[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [info, setInfo] = useState<DbInfo | null>(null)
  const [msg, setMsg] = useState('')

  const refresh = async () => {
    const [l, s, i] = await Promise.all([
      call(api.backup.list()),
      call(api.settings.get()),
      call(api.backup.info()).catch(() => null)
    ])
    setList(l)
    setSettings(s)
    setInfo(i)
  }
  useEffect(() => {
    void refresh()
  }, [])

  const flash = (m: string) => {
    setMsg(m)
    setTimeout(() => setMsg(''), 2000)
  }

  const backupNow = async () => {
    const ok = await call(api.backup.now())
    flash(ok ? t('backups.created') : t('common.canceled'))
    await refresh()
  }

  const restore = async () => {
    const ok = await call(api.backup.restore())
    if (ok) {
      window.alert(t('backups.restoredAlert'))
      onRestored()
    }
  }

  const restoreFile = async (path: string) => {
    const ok = await call(api.backup.restoreFile(path))
    if (ok) {
      window.alert(t('backups.restoredAlert'))
      onRestored()
    }
  }

  const openFolder = async () => {
    await call(api.backup.reveal())
  }

  const chooseDir = async () => {
    const dir = await call(api.backup.chooseDir())
    if (dir) {
      await refresh()
      flash(t('backups.folderUpdated'))
    }
  }

  const saveSetting = async (patch: Partial<Settings>) => {
    const s = await call(api.settings.update(patch))
    setSettings(s)
    flash(t('common.saved'))
  }

  if (!settings) return null

  return (
    <>
      <h1 className="page-title">{t('nav.backups')}</h1>
      {msg && <div className="badge" style={{ marginBottom: 14 }}>{msg}</div>}

      <div className="card" style={{ marginBottom: 22 }}>
        <div className="row">
          <button className="btn" onClick={backupNow}>
            {t('backups.backupNow')}
          </button>
          <button className="btn ghost" onClick={restore}>
            {t('backups.restoreFromFile')}
          </button>
          <button className="btn ghost" onClick={openFolder}>
            {t('backups.openFolder')}
          </button>
        </div>
      </div>

      {info && (
        <div className="card" style={{ marginBottom: 22 }}>
          <h2 style={{ marginBottom: 16 }}>{t('backups.infoHeading')}</h2>
          <div className="stat-grid" style={{ marginBottom: 16 }}>
            <div className="stat">
              <div className="v">{info.entries}</div>
              <div className="k">{t('backups.statClients')}</div>
            </div>
            <div className="stat">
              <div className="v">{info.sessions}</div>
              <div className="k">{t('backups.statSessions')}</div>
            </div>
            <div className="stat">
              <div className="v">{info.services}</div>
              <div className="k">{t('backups.statServices')}</div>
            </div>
            <div className="stat">
              <div className="v">{info.users}</div>
              <div className="k">{t('backups.statUsers')}</div>
            </div>
          </div>
          <div className="row" style={{ gap: 22 }}>
            <span className="muted">
              {t('backups.dbSize')}: <strong>{fmtSize(info.sizeBytes)}</strong>
            </span>
            <span className="muted">
              {t('backups.integrity')}:{' '}
              <strong className={info.integrity === 'ok' ? 'delta up' : 'delta down'} style={{ display: 'inline' }}>
                {info.integrity === 'ok' ? t('backups.integrityOk') : info.integrity}
              </strong>
            </span>
            {info.firstDate && (
              <span className="muted">
                {t('backups.dataRange')}: <strong>{info.firstDate} → {info.lastDate}</strong>
              </span>
            )}
          </div>
          <div className="muted" style={{ marginTop: 14, lineHeight: 1.7 }}>
            <div>{t('backups.included')}</div>
            <div>{t('backups.notIncluded')}</div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 22 }}>
        <h2 style={{ marginBottom: 10 }}>{t('backups.migrateHeading')}</h2>
        <div className="muted" style={{ lineHeight: 1.8 }}>{t('backups.migrateSteps')}</div>
      </div>

      <div className="card" style={{ marginBottom: 22 }}>
        <h2 style={{ marginBottom: 16 }}>{t('backups.autoDailyHeading')}</h2>
        <label className="theme-toggle" style={{ marginBottom: 14 }}>
          <span>{t('backups.enableAuto')}</span>
          <input
            type="checkbox"
            checked={settings.auto_backup}
            onChange={(e) => saveSetting({ auto_backup: e.target.checked })}
          />
        </label>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <label className="field">
            {t('backups.retentionCount')}
            <input
              type="number"
              defaultValue={settings.backup_retention}
              style={{ width: 110 }}
              onBlur={(e) => saveSetting({ backup_retention: parseInt(e.target.value, 10) || 30 })}
            />
          </label>
          <div style={{ flex: 1 }}>
            <div className="muted" style={{ marginBottom: 6 }}>{t('backups.folder')}</div>
            <div className="row">
              <code style={{ fontSize: 13 }}>{settings.backup_dir || t('backups.defaultFolder')}</code>
              <button className="btn ghost sm" onClick={chooseDir}>
                {t('backups.changeFolder')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 16 }}>{t('backups.existing')}</h2>
        <table className="tbl">
          <thead>
            <tr>
              <th>{t('backups.file')}</th>
              <th>{t('backups.size')}</th>
              <th>{t('reports.date')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((b) => (
              <tr key={b.path}>
                <td>{b.file}</td>
                <td>{fmtSize(b.size)}</td>
                <td>{new Date(b.mtime).toLocaleString(localeFor(lang))}</td>
                <td>
                  <button className="btn ghost sm" onClick={() => restoreFile(b.path)}>
                    {t('backups.restore')}
                  </button>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  {t('backups.noBackups')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
