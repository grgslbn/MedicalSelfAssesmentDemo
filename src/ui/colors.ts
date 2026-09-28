const STOPS: [number, [number, number, number]][] = [
  [0, [124, 196, 166]], // mint
  [5, [240, 179, 90]], // amber
  [10, [226, 103, 78]], // coral
]

/** Intensity 0–10 → a warm, continuous hex colour. */
export function intensityColor(v: number): string {
  const x = Math.max(0, Math.min(10, v))
  let i = 0
  while (i < STOPS.length - 2 && x > STOPS[i + 1][0]) i++
  const [a, ca] = STOPS[i]
  const [b, cb] = STOPS[i + 1]
  const t = (x - a) / (b - a)
  const c = ca.map((c0, k) => Math.round(c0 + (cb[k] - c0) * t))
  return `#${c.map((n) => n.toString(16).padStart(2, '0')).join('')}`
}

export const LEVEL_COLORS = ['var(--lvl-0)', 'var(--lvl-1)', 'var(--lvl-2)', 'var(--lvl-3)']
