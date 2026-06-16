import { useEffect, useState } from 'react'
import { api, call } from '../api'
import type { DailyReport, MonthlyReport, RangeReport, Settings } from '../../electron/shared/types'
import { useI18n } from '../i18n'
import { BarChart, LineChart } from '../components/Charts'

type Tab = 'daily' | 'monthly' | 'range'

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function Reports() {
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('daily')
  const [date, setDate] = useState(todayStr())
  const [month, setMonth] = useState(todayStr().slice(0, 7))
  const [from, setFrom] = useState(todayStr().slice(0, 8) + '01')
  const [to, setTo] = useState(todayStr())
  const [daily, setDaily] = useState<DailyReport | null>(null)
  const [monthly, setMonthly] = useState<MonthlyReport | null>(null)
  const [range, setRange] = useState<RangeReport | null>(null)
  const [currency, setCurrency] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    void call(api.settings.get()).then((s: Settings) => setCurrency(s.currency))
  }, [])

  useEffect(() => {
    if (tab === 'daily') void call(api.reports.daily(date)).then(setDaily)
  }, [tab, date])

  useEffect(() => {
    if (tab === 'monthly') void call(api.reports.monthly(month)).then(setMonthly)
  }, [tab, month])

  useEffect(() => {
    if (tab === 'range' && from <= to) void call(api.reports.range(from, to)).then(setRange)
  }, [tab, from, to])

  const doExport = async (format: 'excel' | 'pdf') => {
    const ok =
      tab === 'range'
        ? await call(api.reports.export('range', format, from, to))
        : await call(api.reports.export(tab, format, tab === 'daily' ? date : month))
    setMsg(ok ? t('reports.exported') : t('common.canceled'))
    setTimeout(() => setMsg(''), 1800)
  }

  const money = (n: number) => `${Math.round(n * 100) / 100} ${currency}`

  return (
    <>
      <div className="row" style={{ marginBottom: 18 }}>
        <h1 className="page-title" style={{ margin: 0 }}>
          {t('nav.reports')}
        </h1>
        <div className="spacer" />
        <button className={'btn ' + (tab === 'daily' ? '' : 'ghost')} onClick={() => setTab('daily')}>
          {t('reports.daily')}
        </button>
        <button className={'btn ' + (tab === 'monthly' ? '' : 'ghost')} onClick={() => setTab('monthly')}>
          {t('reports.monthly')}
        </button>
        <button className={'btn ' + (tab === 'range' ? '' : 'ghost')} onClick={() => setTab('range')}>
          {t('reports.range')}
        </button>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="row">
          {tab === 'daily' && (
            <label className="field">
              {t('reports.date')}
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
          )}
          {tab === 'monthly' && (
            <label className="field">
              {t('reports.month')}
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </label>
          )}
          {tab === 'range' && (
            <>
              <label className="field">
                {t('reports.from')}
                <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label className="field">
                {t('reports.to')}
                <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
              </label>
              <div className="row" style={{ gap: 6 }}>
                <button
                  className="btn ghost sm"
                  onClick={() => {
                    setFrom(todayStr().slice(0, 8) + '01')
                    setTo(todayStr())
                  }}
                >
                  {t('reports.quickThisMonth')}
                </button>
                <button
                  className="btn ghost sm"
                  onClick={() => {
                    setFrom(addDays(todayStr(), -29))
                    setTo(todayStr())
                  }}
                >
                  {t('reports.quickLast30')}
                </button>
                <button
                  className="btn ghost sm"
                  onClick={() => {
                    setFrom(todayStr().slice(0, 4) + '-01-01')
                    setTo(todayStr())
                  }}
                >
                  {t('reports.quickThisYear')}
                </button>
              </div>
            </>
          )}
          <div className="spacer" />
          {msg && <span className="badge">{msg}</span>}
          <button className="btn ghost" onClick={() => doExport('excel')}>
            {t('reports.exportExcel')}
          </button>
          <button className="btn ghost" onClick={() => doExport('pdf')}>
            {t('reports.exportPdf')}
          </button>
        </div>
      </div>

      {tab === 'daily' && daily && <DailyView r={daily} currency={currency} />}
      {tab === 'monthly' && monthly && <MonthlyView r={monthly} currency={currency} />}
      {tab === 'range' && range && <RangeView r={range} money={money} />}
    </>
  )
}

function Delta({ cur, prev }: { cur: number; prev: number }) {
  if (prev === 0 && cur === 0) return <div className="delta muted">—</div>
  const pct = prev === 0 ? 100 : Math.round(((cur - prev) / prev) * 100)
  const up = cur >= prev
  return <div className={'delta ' + (up ? 'up' : 'down')}>{up ? '▲' : '▼'} {Math.abs(pct)}%</div>
}

function RangeView({ r, money }: { r: RangeReport; money: (n: number) => string }) {
  const { t } = useI18n()
  if (r.totalCount === 0) {
    return <div className="card muted">{t('reports.noData')}</div>
  }
  const avg = r.totalCount ? r.totalRevenue / r.totalCount : 0
  const hours = [...r.perHour].sort((a, b) => b.count - a.count).slice(0, 8)

  return (
    <>
      <div className="stat-grid" style={{ marginBottom: 18 }}>
        <div className="stat">
          <div className="v">{r.totalCount}</div>
          <div className="k">{t('reports.clientsCount')}</div>
          <Delta cur={r.totalCount} prev={r.prevTotalCount} />
        </div>
        <div className="stat">
          <div className="v">{money(r.totalRevenue)}</div>
          <div className="k">{t('reports.totalRevenue')}</div>
          <Delta cur={r.totalRevenue} prev={r.prevTotalRevenue} />
        </div>
        <div className="stat">
          <div className="v">{money(avg)}</div>
          <div className="k">{t('reports.avgPerClient')}</div>
        </div>
        <div className="stat">
          <div className="v">{r.sessions}</div>
          <div className="k">{t('reports.sessionsCount')}</div>
        </div>
      </div>

      <div className="muted" style={{ marginBottom: 18 }}>
        {t('reports.vsPrev', { from: r.prevFrom, to: r.prevTo })}
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <h2 style={{ marginBottom: 12 }}>{t('reports.revenueOverTime')}</h2>
        <LineChart
          points={r.perDay.map((d) => ({ label: d.date.slice(5), value: d.revenue }))}
          format={money}
        />
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
        <div className="card">
          <h2 style={{ marginBottom: 16 }}>{t('reports.byService')}</h2>
          <BarChart
            data={r.perType.map((s) => ({
              label: s.name,
              value: s.revenue,
              sub: `${money(s.revenue)} · ${s.count}`
            }))}
          />
        </div>
        <div className="card">
          <h2 style={{ marginBottom: 16 }}>{t('reports.busiestHours')}</h2>
          <BarChart
            data={hours.map((h) => ({
              label: `${String(h.hour).padStart(2, '0')}:00`,
              value: h.count,
              sub: String(h.count)
            }))}
          />
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 16 }}>{t('reports.byEmployee')}</h2>
        <table className="tbl">
          <thead>
            <tr>
              <th>{t('reports.employee')}</th>
              <th>{t('common.count')}</th>
              <th>{t('common.revenue')}</th>
            </tr>
          </thead>
          <tbody>
            {r.perUser.map((u) => (
              <tr key={u.user_id}>
                <td>{u.name}</td>
                <td>{u.count}</td>
                <td>{money(u.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function DailyView({ r, currency }: { r: DailyReport; currency: string }) {
  const { t } = useI18n()
  return (
    <>
      <div className="stat-grid" style={{ marginBottom: 18 }}>
        <div className="stat">
          <div className="v">{r.totalCount}</div>
          <div className="k">{t('reports.clientsCount')}</div>
        </div>
        <div className="stat">
          <div className="v">
            {r.totalRevenue} {currency}
          </div>
          <div className="k">{t('reports.totalRevenue')}</div>
        </div>
        <div className="stat">
          <div className="v">{r.sessions}</div>
          <div className="k">{t('reports.sessionsCount')}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <h2 style={{ marginBottom: 12 }}>{t('reports.byService')}</h2>
        <table className="tbl">
          <thead>
            <tr>
              <th>{t('common.service')}</th>
              <th>{t('common.count')}</th>
              <th>{t('common.revenue')}</th>
            </tr>
          </thead>
          <tbody>
            {r.perType.map((tp) => (
              <tr key={tp.type_id}>
                <td>{tp.name}</td>
                <td>{tp.count}</td>
                <td>
                  {tp.revenue} {currency}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 12 }}>{t('reports.details')}</h2>
        <table className="tbl">
          <thead>
            <tr>
              <th>{t('reports.number')}</th>
              <th>{t('common.service')}</th>
              <th>{t('common.price')}</th>
              <th>{t('common.user')}</th>
              <th>{t('common.time')}</th>
            </tr>
          </thead>
          <tbody>
            {r.entries.map((e) => (
              <tr key={e.id}>
                <td>{e.seq_no}</td>
                <td>{e.type_name_snapshot}</td>
                <td>
                  {e.price_snapshot} {currency}
                </td>
                <td>{e.user_name}</td>
                <td>{e.created_at.slice(11, 16)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function MonthlyView({ r, currency }: { r: MonthlyReport; currency: string }) {
  const { t } = useI18n()
  return (
    <>
      <div className="stat-grid" style={{ marginBottom: 18 }}>
        <div className="stat">
          <div className="v">{r.totalCount}</div>
          <div className="k">{t('reports.clientsCount')}</div>
        </div>
        <div className="stat">
          <div className="v">
            {r.totalRevenue} {currency}
          </div>
          <div className="k">{t('reports.totalRevenue')}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <h2 style={{ marginBottom: 12 }}>{t('reports.byDay')}</h2>
        <table className="tbl">
          <thead>
            <tr>
              <th>{t('reports.day')}</th>
              <th>{t('reports.clientsCount')}</th>
              <th>{t('common.revenue')}</th>
            </tr>
          </thead>
          <tbody>
            {r.perDay.map((d) => (
              <tr key={d.date}>
                <td>{d.date}</td>
                <td>{d.count}</td>
                <td>
                  {d.revenue} {currency}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 12 }}>{t('reports.byService')}</h2>
        <table className="tbl">
          <thead>
            <tr>
              <th>{t('common.service')}</th>
              <th>{t('common.count')}</th>
              <th>{t('common.revenue')}</th>
            </tr>
          </thead>
          <tbody>
            {r.perType.map((tp) => (
              <tr key={tp.type_id}>
                <td>{tp.name}</td>
                <td>{tp.count}</td>
                <td>
                  {tp.revenue} {currency}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
