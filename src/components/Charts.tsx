// Lightweight, dependency-free charts that follow the active theme via CSS variables.

type Num = (n: number) => string

const identity: Num = (n) => String(n)

/** Horizontal bars — good for per-service, per-employee, busiest hours. */
export function BarChart({
  data,
  format = identity,
  color = 'var(--accent)'
}: {
  data: { label: string; value: number; sub?: string }[]
  format?: Num
  color?: string
}) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="bars">
      {data.map((d, i) => (
        <div className="bar-row" key={i}>
          <div className="bar-label" title={d.label}>
            {d.label}
          </div>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{ width: `${(d.value / max) * 100}%`, background: color }}
            />
          </div>
          <div className="bar-value">{d.sub ?? format(d.value)}</div>
        </div>
      ))}
      {data.length === 0 && <div className="muted">—</div>}
    </div>
  )
}

/** Revenue-over-time line chart drawn as scalable SVG. */
export function LineChart({
  points,
  format = identity,
  height = 200
}: {
  points: { label: string; value: number }[]
  format?: Num
  height?: number
}) {
  const W = 600
  const H = height
  const padX = 8
  const padY = 16
  const max = Math.max(1, ...points.map((p) => p.value))
  const n = points.length

  const x = (i: number) => (n <= 1 ? W / 2 : padX + (i * (W - padX * 2)) / (n - 1))
  const y = (v: number) => H - padY - (v / max) * (H - padY * 2)

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.value)}`).join(' ')
  const area = n
    ? `M ${x(0)} ${H - padY} ` +
      points.map((p, i) => `L ${x(i)} ${y(p.value)}`).join(' ') +
      ` L ${x(n - 1)} ${H - padY} Z`
    : ''

  if (n === 0) return <div className="muted">—</div>

  return (
    <div className="linechart">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={H}>
        <path d={area} fill="var(--accent)" opacity={0.12} />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.value)} r={3} fill="var(--accent)">
            <title>{`${p.label}: ${format(p.value)}`}</title>
          </circle>
        ))}
      </svg>
      <div className="linechart-axis">
        <span>{points[0].label}</span>
        <span className="muted">{format(max)}</span>
        <span>{points[n - 1].label}</span>
      </div>
    </div>
  )
}
