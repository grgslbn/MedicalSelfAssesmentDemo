export type Side = 'front' | 'back' | 'any'

export type RegionGroup =
  | 'head' | 'neck' | 'chest' | 'upperBack' | 'abdomen' | 'lowerBack' | 'pelvis' | 'glutes'
  | 'shoulder' | 'upperArm' | 'forearm' | 'hand' | 'thigh' | 'knee' | 'shin' | 'foot'

export interface Region {
  id: string
  label: string
  group: RegionGroup
  a: [number, number, number]
  b: [number, number, number]
  r: number
  side: Side
  /** camera distance when focused */
  zoom: number
}

type Def = Omit<Region, 'id' | 'label'> & { id: string; label: string }

const mirrored = (id: string, label: string, d: Omit<Region, 'id' | 'label'>): Def[] => [
  { ...d, id: `${id}L`, label: `Left ${label}` },
  { ...d, id: `${id}R`, label: `Right ${label}`, a: [-d.a[0], d.a[1], d.a[2]], b: [-d.b[0], d.b[1], d.b[2]] },
]

/** Patient's left is +x (the figure faces the viewer). */
export const REGIONS: Region[] = [
  { id: 'head', label: 'Head & face', group: 'head', a: [0, 1.6, 0], b: [0, 1.68, 0], r: 0.09, side: 'any', zoom: 1.0 },
  { id: 'neck', label: 'Neck & throat', group: 'neck', a: [0, 1.48, 0], b: [0, 1.53, 0], r: 0.05, side: 'any', zoom: 1.0 },
  { id: 'chest', label: 'Chest', group: 'chest', a: [0, 1.26, 0], b: [0, 1.4, 0], r: 0.13, side: 'front', zoom: 1.3 },
  { id: 'upperBack', label: 'Upper back', group: 'upperBack', a: [0, 1.26, 0], b: [0, 1.4, 0], r: 0.13, side: 'back', zoom: 1.3 },
  { id: 'abdomen', label: 'Abdomen', group: 'abdomen', a: [0, 1.06, 0], b: [0, 1.18, 0], r: 0.12, side: 'front', zoom: 1.3 },
  { id: 'lowerBack', label: 'Lower back', group: 'lowerBack', a: [0, 1.06, 0], b: [0, 1.18, 0], r: 0.12, side: 'back', zoom: 1.3 },
  { id: 'pelvis', label: 'Pelvis & groin', group: 'pelvis', a: [0, 0.9, 0], b: [0, 0.97, 0], r: 0.13, side: 'front', zoom: 1.3 },
  { id: 'glutes', label: 'Hips & buttocks', group: 'glutes', a: [0, 0.9, 0], b: [0, 0.97, 0], r: 0.13, side: 'back', zoom: 1.3 },
  ...mirrored('shoulder', 'shoulder', { group: 'shoulder', a: [0.19, 1.4, -0.01], b: [0.19, 1.4, -0.01], r: 0.055, side: 'any', zoom: 1.1 }),
  ...mirrored('upperArm', 'upper arm', { group: 'upperArm', a: [0.205, 1.34, -0.01], b: [0.24, 1.17, -0.02], r: 0.042, side: 'any', zoom: 1.2 }),
  ...mirrored('forearm', 'elbow & forearm', { group: 'forearm', a: [0.247, 1.12, -0.02], b: [0.29, 0.92, 0.015], r: 0.034, side: 'any', zoom: 1.2 }),
  ...mirrored('hand', 'hand & wrist', { group: 'hand', a: [0.298, 0.885, 0.025], b: [0.315, 0.75, 0.045], r: 0.03, side: 'any', zoom: 0.9 }),
  ...mirrored('thigh', 'thigh', { group: 'thigh', a: [0.086, 0.85, 0], b: [0.094, 0.585, 0.005], r: 0.07, side: 'any', zoom: 1.35 }),
  ...mirrored('knee', 'knee', { group: 'knee', a: [0.096, 0.5, 0.01], b: [0.096, 0.5, 0.01], r: 0.05, side: 'any', zoom: 1.0 }),
  ...mirrored('shin', 'lower leg', { group: 'shin', a: [0.097, 0.42, -0.01], b: [0.1, 0.12, -0.01], r: 0.042, side: 'any', zoom: 1.3 }),
  ...mirrored('foot', 'foot & ankle', { group: 'foot', a: [0.1, 0.05, -0.02], b: [0.108, 0.03, 0.1], r: 0.032, side: 'any', zoom: 0.95 }),
]

export const REGION_INDEX: Record<string, number> = Object.fromEntries(REGIONS.map((r, i) => [r.id, i]))
export const regionById = (id: string) => REGIONS[REGION_INDEX[id]]

export function regionCenter(r: Region): [number, number, number] {
  return [(r.a[0] + r.b[0]) / 2, (r.a[1] + r.b[1]) / 2, (r.a[2] + r.b[2]) / 2]
}

function segDist(p: [number, number, number], r: Region) {
  const [ax, ay, az] = r.a
  const bx = r.b[0] - ax, by = r.b[1] - ay, bz = r.b[2] - az
  const px = p[0] - ax, py = p[1] - ay, pz = p[2] - az
  const l2 = bx * bx + by * by + bz * bz
  const t = l2 > 0 ? Math.max(0, Math.min(1, (px * bx + py * by + pz * bz) / l2)) : 0
  return Math.hypot(px - bx * t, py - by * t, pz - bz * t) - r.r
}

/** Same classification the shader performs — keep in sync with bodyMaterial.ts */
export function regionAt(p: [number, number, number]): Region {
  let best = 0, bd = Infinity
  for (let i = 0; i < REGIONS.length; i++) {
    const r = REGIONS[i]
    if (r.side === 'front' && p[2] < 0) continue
    if (r.side === 'back' && p[2] >= 0) continue
    const d = segDist(p, r)
    if (d < bd) { bd = d; best = i }
  }
  return REGIONS[best]
}

/** Whether a region is better seen from behind. */
export const isBackRegion = (r: Region) => r.side === 'back'
