import { REGIONS, regionById } from '../data/regions'
import type { Entry } from '../state/store'
import { intensityColor } from './colors'

/** Flat front/back map drawn from the same zone skeleton the 3D body uses. */
export function BodyMap({ entries, compact = false }: { entries: Entry[]; compact?: boolean }) {
  const S = 100 // px per metre-ish scale factor (viewBox units)
  const H = 1.8
  const view = (side: 'front' | 'back', ox: number) => {
    const flip = side === 'back' ? -1 : 1
    const X = (x: number) => ox + x * S * flip
    const Y = (y: number) => (H - y) * S
    const logged = new Map<string, number>()
    for (const e of entries) {
      if (e.regionId === 'general') continue
      const r = regionById(e.regionId)
      const z = e.point?.[2] ?? (r.side === 'back' ? -1 : 1)
      const isBack = r.side === 'back' || (r.side === 'any' && z < -0.03)
      if ((side === 'back') !== isBack) continue
      logged.set(e.regionId, Math.max(logged.get(e.regionId) ?? 0, e.intensity))
    }
    return (
      <g>
        <g className="map-body">
          <ellipse cx={X(0)} cy={Y(1.635)} rx={0.082 * S} ry={0.108 * S} />
          {REGIONS.filter((r) => r.side !== (side === 'front' ? 'back' : 'front') && r.group !== 'head').map((r) => (
            <line key={r.id} x1={X(r.a[0])} y1={Y(r.a[1])} x2={X(r.b[0])} y2={Y(r.b[1])} strokeWidth={r.r * 2 * S} />
          ))}
          <ellipse cx={X(0)} cy={Y(1.335)} rx={0.15 * S} ry={0.15 * S} />
          <ellipse cx={X(0)} cy={Y(1.13)} rx={0.12 * S} ry={0.14 * S} />
          <ellipse cx={X(0)} cy={Y(0.95)} rx={0.15 * S} ry={0.11 * S} />
        </g>
        {[...logged].map(([id, v]) => {
          const r = regionById(id)
          const isHead = r.group === 'head'
          return isHead ? (
            <ellipse key={id} cx={X(0)} cy={Y(1.635)} rx={0.082 * S} ry={0.108 * S} fill={intensityColor(v)} opacity={0.85} />
          ) : (
            <line key={id} x1={X(r.a[0])} y1={Y(r.a[1])} x2={X(r.b[0])} y2={Y(r.b[1])} strokeWidth={r.r * 2 * S * 0.92}
              stroke={intensityColor(v)} strokeLinecap="round" opacity={0.85} />
          )
        })}
        {entries.filter((e) => e.point && e.regionId !== 'general').map((e) => {
          const r = regionById(e.regionId)
          const z = e.point![2]
          const isBack = r.side === 'back' || (r.side === 'any' && z < -0.03)
          if ((side === 'back') !== isBack) return null
          return <circle key={e.id} cx={X(e.point![0])} cy={Y(e.point![1])} r={2.4} className="map-dot" />
        })}
        <text x={ox} y={H * S + 12} className="map-label" textAnchor="middle">{side === 'front' ? 'Front' : 'Back'}</text>
      </g>
    )
  }
  return (
    <svg className={`body-map ${compact ? 'compact' : ''}`} viewBox={`0 -4 ${1.9 * S} ${H * S + 18}`} role="img"
      aria-label={`Body map with ${entries.length} logged symptom${entries.length === 1 ? '' : 's'}`}>
      {view('front', 0.45 * S)}
      {view('back', 1.45 * S)}
    </svg>
  )
}
