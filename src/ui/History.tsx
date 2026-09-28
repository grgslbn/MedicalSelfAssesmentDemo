import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { regionById } from '../data/regions'
import { LEVELS } from '../logic/triage'
import { useStore, type CheckIn } from '../state/store'
import { BodyMap } from './BodyMap'
import { Icon } from './icons'
import { EntryCard } from './Summary'
import { IconButton, Sheet, Stagger, item, spring } from './kit'

const fmt = (d: number, o: Intl.DateTimeFormatOptions) => new Date(d).toLocaleDateString(undefined, o)

function TrendChart({ list }: { list: CheckIn[] }) {
  const pts = [...list].reverse().slice(-12)
  const [hover, setHover] = useState<number | null>(null)
  const W = 320, H = 120, P = { l: 22, r: 10, t: 12, b: 20 }
  const x = (i: number) => P.l + (pts.length === 1 ? (W - P.l - P.r) / 2 : (i / (pts.length - 1)) * (W - P.l - P.r))
  const y = (v: number) => P.t + (1 - v / 10) * (H - P.t - P.b)
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.peak).toFixed(1)}`).join(' ')
  const area = `${d} L${x(pts.length - 1)},${y(0)} L${x(0)},${y(0)} Z`
  const h = hover !== null ? pts[hover] : null
  return (
    <div className="chart" onPointerLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Peak intensity per check-in, out of 10">
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity=".22" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 5, 10].map((v) => (
          <g key={v}>
            <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} className="grid" />
            <text x={P.l - 6} y={y(v) + 3} className="axis" textAnchor="end">{v}</text>
          </g>
        ))}
        <motion.path d={area} fill="url(#trendFill)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} />
        <motion.path d={d} className="line" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }} />
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={P.t} y2={y(0)} className="cross" />}
        {pts.map((p, i) => (
          <g key={p.id}>
            <circle cx={x(i)} cy={y(p.peak)} r={hover === i ? 5 : 4} className="pt" />
            <rect x={x(i) - 14} y={0} width={28} height={H} fill="transparent" onPointerEnter={() => setHover(i)} onClick={() => setHover(i)} />
          </g>
        ))}
        {pts.length > 0 && (
          <>
            <text x={x(0)} y={H - 4} className="axis" textAnchor="start">{fmt(pts[0].date, { day: 'numeric', month: 'short' })}</text>
            {pts.length > 1 && <text x={x(pts.length - 1)} y={H - 4} className="axis" textAnchor="end">{fmt(pts[pts.length - 1].date, { day: 'numeric', month: 'short' })}</text>}
          </>
        )}
      </svg>
      <AnimatePresence>
        {h && (
          <motion.div className="tip" style={{ left: `${(x(hover!) / W) * 100}%` }} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <b>{h.peak}/10</b> peak · {fmt(h.date, { day: 'numeric', month: 'short' })}
            <small>{LEVELS[h.level].title}</small>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function TopZones({ list }: { list: CheckIn[] }) {
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of list) for (const id of new Set(c.entries.map((e) => e.regionId))) m.set(id, (m.get(id) ?? 0) + 1)
    return [...m].sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [list])
  const max = Math.max(1, ...counts.map((c) => c[1]))
  return (
    <div className="zones">
      {counts.map(([id, n], i) => (
        <div key={id} className="zone-row" title={`${n} check-in${n > 1 ? 's' : ''}`}>
          <span className="zone-name">{id === 'general' ? 'Whole body' : regionById(id).label}</span>
          <span className="zone-bar"><motion.span initial={{ width: 0 }} animate={{ width: `${(n / max) * 100}%` }} transition={{ ...spring, delay: 0.1 + i * 0.05 }} /></span>
          <span className="zone-n">{n}×</span>
        </div>
      ))}
    </div>
  )
}

export function History() {
  const history = useStore((s) => s.history)
  const set = useStore((s) => s.set)
  const [open, setOpen] = useState<string | null>(history[0]?.id ?? null)
  const close = () => set({ view: 'explore' })

  return (
    <Sheet label="History" onClose={close} tall>
      <header className="sheet-head">
        <div>
          <div className="eyebrow">Your health diary</div>
          <h2>History</h2>
        </div>
        <IconButton label="Close" onClick={close}><Icon.close /></IconButton>
      </header>
      <div className="sheet-body scroll">
        <Stagger>
          {history.length === 0 ? (
            <motion.div variants={item} className="empty">
              <Icon.history size={28} />
              <p>Your saved check-ins will appear here, so you can spot patterns over time and share them with your doctor.</p>
              <button className="btn primary" onClick={close}>Start a check-in</button>
            </motion.div>
          ) : (
            <>
              <motion.h4 variants={item}>Peak intensity</motion.h4>
              <motion.div variants={item} className="card"><TrendChart list={history} /></motion.div>
              <motion.h4 variants={item}>Most frequent zones</motion.h4>
              <motion.div variants={item} className="card"><TopZones list={history} /></motion.div>
              <motion.h4 variants={item}>Check-ins <span className="count">{history.length}</span></motion.h4>
              <div className="timeline">
                {history.map((c) => (
                  <motion.div variants={item} key={c.id} className={`tl-item ${open === c.id ? 'open' : ''}`}>
                    <button className="tl-head" onClick={() => setOpen(open === c.id ? null : c.id)} aria-expanded={open === c.id}>
                      <span className={`tl-dot lvl-${c.level}`} />
                      <span className="tl-date">
                        <b>{fmt(c.date, { weekday: 'short', day: 'numeric', month: 'short' })}</b>
                        <small>{c.entries.length} symptom{c.entries.length > 1 ? 's' : ''} · peak {c.peak}/10</small>
                      </span>
                      <span className={`badge lvl-${c.level}`}>{LEVELS[c.level].title}</span>
                    </button>
                    <AnimatePresence initial={false}>
                      {open === c.id && (
                        <motion.div className="tl-body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring}>
                          <div className="tl-inner">
                            <BodyMap entries={c.entries} compact />
                            <Stagger className="entries">{c.entries.map((e) => <EntryCard key={e.id} e={e} />)}</Stagger>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </Stagger>
      </div>
    </Sheet>
  )
}
