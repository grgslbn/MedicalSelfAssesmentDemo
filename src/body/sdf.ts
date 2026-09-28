/**
 * A gender-neutral figure sculpted from signed-distance primitives.
 * Units are metres; feet rest on y = 0; the figure faces +z.
 * The patient's left side is +x.
 *
 * Primitives are applied in order: `add` blends in with a smooth union,
 * `sub` carves with a smooth subtraction (eye sockets, mouth line, …).
 */

export type Vec3 = [number, number, number]

const Kind = { Cone: 0, Ell: 1 } as const
type Kind = (typeof Kind)[keyof typeof Kind]

export interface Prim {
  kind: Kind
  sub: boolean
  a: Vec3 // cone start / ellipsoid centre
  b: Vec3 // cone end
  r1: number
  r2: number
  // oriented ellipsoid: local axes (unit) and radii
  u: Vec3; v: Vec3; w: Vec3
  rad: Vec3
  k: number // blend radius
  min: Vec3 // bounds padded by the blend radius
  max: Vec3
}

export const prims: Prim[] = []

// ── tiny vector helpers ──────────────────────────────────────────────────
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const mul = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s]
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const norm = (a: Vec3): Vec3 => mul(a, 1 / Math.hypot(a[0], a[1], a[2]))
const mix3 = (...terms: [Vec3, number][]): Vec3 => norm(terms.reduce<Vec3>((acc, [v, s]) => add(acc, mul(v, s)), [0, 0, 0]))
const mirrorX = (p: Vec3): Vec3 => [-p[0], p[1], p[2]]

function pad(p: Omit<Prim, 'min' | 'max'>): Prim {
  let min: Vec3, max: Vec3
  if (p.kind === Kind.Ell) {
    const r = Math.max(...p.rad)
    min = [p.a[0] - r, p.a[1] - r, p.a[2] - r]
    max = [p.a[0] + r, p.a[1] + r, p.a[2] + r]
  } else {
    const r = Math.max(p.r1, p.r2)
    min = [Math.min(p.a[0], p.b[0]) - r, Math.min(p.a[1], p.b[1]) - r, Math.min(p.a[2], p.b[2]) - r]
    max = [Math.max(p.a[0], p.b[0]) + r, Math.max(p.a[1], p.b[1]) + r, Math.max(p.a[2], p.b[2]) + r]
  }
  return { ...p, min, max }
}

const X: Vec3 = [1, 0, 0], Y: Vec3 = [0, 1, 0], Z: Vec3 = [0, 0, 1]
const O: Vec3 = [0, 0, 0]

interface Opts { k?: number; sub?: boolean; mirror?: boolean }

function cone(a: Vec3, b: Vec3, r1: number, r2: number, { k = 0.03, sub = false, mirror = false }: Opts = {}) {
  prims.push(pad({ kind: Kind.Cone, sub, a, b, r1, r2, u: X, v: Y, w: Z, rad: O, k }))
  if (mirror) prims.push(pad({ kind: Kind.Cone, sub, a: mirrorX(a), b: mirrorX(b), r1, r2, u: X, v: Y, w: Z, rad: O, k }))
}

/** Ellipsoid; optionally oriented by axes (u, v, w). Mirroring reflects the axes too. */
function ell(c: Vec3, rad: Vec3, { k = 0.03, sub = false, mirror = false }: Opts = {}, axes: [Vec3, Vec3, Vec3] = [X, Y, Z]) {
  const [u, v, w] = axes
  prims.push(pad({ kind: Kind.Ell, sub, a: c, b: O, r1: 0, r2: 0, u, v, w, rad, k }))
  if (mirror) prims.push(pad({ kind: Kind.Ell, sub, a: mirrorX(c), b: O, r1: 0, r2: 0, u: mirrorX(u), v: mirrorX(v), w: mirrorX(w), rad, k }))
}
const sphere = (c: Vec3, r: number, o: Opts = {}) => ell(c, [r, r, r], o)

// ── Sculpt ────────────────────────────────────────────────────────────────
// Head: cranium, facial mask, jaw and chin
ell([0, 1.648, -0.006], [0.075, 0.092, 0.091], { k: 0.03 })
ell([0, 1.6, 0.028], [0.056, 0.072, 0.068], { k: 0.03 })
sphere([0.044, 1.59, -0.01], 0.02, { k: 0.03, mirror: true }) // jaw angle
ell([0, 1.551, 0.068], [0.02, 0.016, 0.018], { k: 0.022 }) // chin
ell([0.037, 1.628, 0.068], [0.019, 0.011, 0.016], { k: 0.02, mirror: true }) // cheekbones
ell([0, 1.667, 0.072], [0.052, 0.012, 0.02], { k: 0.03 }) // brow ridge
// eyes: shallow sockets with calm, almond-shaped statue eyes
ell([0.03, 1.645, 0.087], [0.018, 0.012, 0.014], { k: 0.012, sub: true, mirror: true })
ell([0.03, 1.644, 0.07], [0.0125, 0.0082, 0.0105], { k: 0.004, mirror: true }, [norm([1, 0, 0.25]), Y, norm([-0.25, 0, 1])])
// nose: bridge, tip, wings
cone([0, 1.654, 0.082], [0, 1.61, 0.105], 0.0055, 0.0075, { k: 0.012 })
sphere([0, 1.605, 0.103], 0.0088, { k: 0.009 })
sphere([0.0095, 1.601, 0.096], 0.0068, { k: 0.009, mirror: true })
// mouth: the lips meet in a natural crease
ell([0, 1.5795, 0.0915], [0.0175, 0.0055, 0.0085], { k: 0.01 })
ell([0, 1.5672, 0.0893], [0.0155, 0.0062, 0.009], { k: 0.0065 })
// ears
ell([0.076, 1.63, -0.008], [0.009, 0.029, 0.018], { k: 0.01, mirror: true }, [X, norm([0, 1, -0.15]), norm([0, 0.15, 1])])
ell([0.084, 1.627, -0.004], [0.006, 0.016, 0.009], { k: 0.005, sub: true, mirror: true })

// Neck
cone([0, 1.44, -0.005], [0, 1.585, -0.012], 0.05, 0.045, { k: 0.03 })
cone([0.05, 1.585, -0.01], [0.016, 1.455, 0.04], 0.013, 0.012, { k: 0.022, mirror: true }) // sternocleidomastoid

// Torso
ell([0, 1.335, 0.0], [0.148, 0.145, 0.098], { k: 0.05 }) // ribcage
ell([0.055, 1.31, 0.045], [0.07, 0.055, 0.05], { k: 0.04, mirror: true }) // chest
cone([0.04, 1.43, -0.01], [0.175, 1.41, -0.008], 0.052, 0.05, { k: 0.05, mirror: true }) // trapezius → shoulder
cone([0.018, 1.438, 0.045], [0.15, 1.425, 0.02], 0.009, 0.009, { k: 0.02, mirror: true }) // collarbone
ell([0.185, 1.395, -0.005], [0.058, 0.055, 0.058], { k: 0.035, mirror: true }) // deltoid
ell([0.062, 1.325, -0.078], [0.048, 0.062, 0.016], { k: 0.05, mirror: true }) // shoulder blades
ell([0, 1.13, 0.005], [0.118, 0.13, 0.085], { k: 0.07 }) // waist
ell([0, 1.33, -0.105], [0.008, 0.19, 0.012], { k: 0.02, sub: true }) // spine groove
sphere([0, 1.05, 0.093], 0.0065, { k: 0.006, sub: true }) // navel
ell([0, 0.965, -0.005], [0.148, 0.105, 0.098], { k: 0.06 }) // pelvis
ell([0.068, 0.925, -0.045], [0.072, 0.08, 0.07], { k: 0.04, mirror: true }) // glutes

// Arms (relaxed A-pose so every zone is easy to tap)
cone([0.2, 1.385, -0.01], [0.245, 1.135, -0.02], 0.047, 0.036, { k: 0.03, mirror: true })
cone([0.245, 1.135, -0.02], [0.292, 0.905, 0.018], 0.036, 0.024, { k: 0.02, mirror: true })
ell([0.262, 1.04, -0.005], [0.036, 0.075, 0.038], { k: 0.03, mirror: true }) // forearm muscle

// Hands — built in a hand frame so fingers curl naturally
const WRIST: Vec3 = [0.294, 0.895, 0.02]
const DOWN = norm([0.2, -0.97, 0.12]) // continues the forearm
const PALM_N = norm(cross(DOWN, Z)) // palm faces the thigh (−x)
const ACROSS = norm(cross(PALM_N, DOWN)) // towards the thumb (+z)
export const HAND_FRAME = { WRIST, DOWN, PALM_N, ACROSS }

function hand() {
  const at = (d: number, l: number, n: number): Vec3 => add(add(add(WRIST, mul(DOWN, d)), mul(ACROSS, l)), mul(PALM_N, n))
  // wrist, palm and the fleshy base of the thumb
  cone(at(-0.02, 0, 0), at(0.012, 0, 0), 0.023, 0.021, { k: 0.02, mirror: true })
  ell(at(0.05, -0.001, 0), [0.036, 0.047, 0.0135], { k: 0.016, mirror: true }, [ACROSS, DOWN, PALM_N])
  ell(at(0.035, 0.022, 0.009), [0.014, 0.026, 0.012], { k: 0.012, mirror: true }, [ACROSS, DOWN, PALM_N])

  const fingers = [
    { off: 0.025, len: [0.042, 0.025, 0.02], r: 0.0088, spread: 0.1 },
    { off: 0.0085, len: [0.047, 0.029, 0.022], r: 0.009, spread: 0.02 },
    { off: -0.0085, len: [0.044, 0.027, 0.021], r: 0.0085, spread: -0.06 },
    { off: -0.024, len: [0.034, 0.02, 0.018], r: 0.0075, spread: -0.16 },
  ]
  const curl = [0.28, 0.42, 0.32] // radians per joint, towards the palm
  for (const f of fingers) {
    let p = at(0.092 - Math.abs(f.off) * 0.25, f.off, 0.001)
    let ang = 0.12
    let r = f.r
    for (let j = 0; j < 3; j++) {
      ang += curl[j]
      const dir = mix3([DOWN, Math.cos(ang)], [PALM_N, Math.sin(ang)], [ACROSS, f.spread])
      const q = add(p, mul(dir, f.len[j]))
      const r2 = r * (j === 2 ? 0.8 : 0.88)
      cone(p, q, r, r2, { k: j === 0 ? 0.006 : 0.003, mirror: true })
      p = q
      r = r2
    }
  }
  // thumb: metacarpal, proximal, distal
  const t0 = at(0.022, 0.024, 0.007)
  const d1 = mix3([DOWN, 0.55], [ACROSS, 0.65], [PALM_N, 0.52])
  const t1 = add(t0, mul(d1, 0.04))
  const d2 = mix3([DOWN, 0.8], [ACROSS, 0.3], [PALM_N, 0.52])
  const t2 = add(t1, mul(d2, 0.031))
  const d3 = mix3([DOWN, 0.75], [ACROSS, 0.12], [PALM_N, 0.66])
  const t3 = add(t2, mul(d3, 0.026))
  cone(t0, t1, 0.013, 0.0105, { k: 0.01, mirror: true })
  cone(t1, t2, 0.0105, 0.0095, { k: 0.004, mirror: true })
  cone(t2, t3, 0.0095, 0.0078, { k: 0.003, mirror: true })
}
hand()

// Legs
cone([0.083, 0.93, 0.0], [0.095, 0.515, 0.008], 0.085, 0.05, { k: 0.05, mirror: true })
ell([0.096, 0.497, 0.03], [0.034, 0.038, 0.024], { k: 0.025, mirror: true }) // kneecap
ell([0.096, 0.495, 0.005], [0.048, 0.05, 0.048], { k: 0.03, mirror: true }) // knee
cone([0.096, 0.48, 0.0], [0.1, 0.085, -0.012], 0.047, 0.03, { k: 0.03, mirror: true })
ell([0.098, 0.37, -0.028], [0.043, 0.085, 0.042], { k: 0.04, mirror: true }) // calf
sphere([0.122, 0.078, -0.012], 0.014, { k: 0.02, mirror: true }) // outer ankle bone
sphere([0.08, 0.085, -0.008], 0.013, { k: 0.02, mirror: true }) // inner ankle bone

// Feet: heel, arch, ball and five toes
ell([0.1, 0.038, -0.035], [0.03, 0.035, 0.035], { k: 0.025, mirror: true }) // heel
cone([0.1, 0.045, -0.02], [0.106, 0.028, 0.075], 0.036, 0.027, { k: 0.03, mirror: true })
ell([0.106, 0.02, 0.083], [0.041, 0.019, 0.024], { k: 0.02, mirror: true }) // ball of the foot
const TOES = [
  { x: 0.084, z: 0.09, len: 0.042, r: 0.0122 },
  { x: 0.1, z: 0.088, len: 0.036, r: 0.0086 },
  { x: 0.113, z: 0.083, len: 0.032, r: 0.008 },
  { x: 0.124, z: 0.076, len: 0.028, r: 0.0075 },
  { x: 0.134, z: 0.068, len: 0.023, r: 0.007 },
]
for (const t of TOES) {
  const tip: Vec3 = [t.x + (t.x - 0.1) * 0.1, t.r * 0.95, t.z + t.len]
  cone([t.x, 0.02, t.z], tip, t.r, t.r * 0.88, { k: 0.005, mirror: true })
}

// ── Evaluation ───────────────────────────────────────────────────────────

function sdRoundCone(px: number, py: number, pz: number, p: Prim) {
  // Inigo Quilez — round cone between two spheres
  const [ax, ay, az] = p.a
  const bx = p.b[0] - ax, by = p.b[1] - ay, bz = p.b[2] - az
  const qx = px - ax, qy = py - ay, qz = pz - az
  const r1 = p.r1, r2 = p.r2
  const l2 = bx * bx + by * by + bz * bz
  const rr = r1 - r2
  const a2 = l2 - rr * rr
  const il2 = 1 / l2
  const y = qx * bx + qy * by + qz * bz
  const z = y - l2
  const cx = qx * l2 - bx * y, cy = qy * l2 - by * y, cz = qz * l2 - bz * y
  const x2 = cx * cx + cy * cy + cz * cz
  const y2 = y * y * l2
  const z2 = z * z * l2
  const k = Math.sign(rr) * rr * rr * x2
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1
}

function sdEllipsoid(px: number, py: number, pz: number, p: Prim) {
  const dx = px - p.a[0], dy = py - p.a[1], dz = pz - p.a[2]
  const x = dx * p.u[0] + dy * p.u[1] + dz * p.u[2]
  const y = dx * p.v[0] + dy * p.v[1] + dz * p.v[2]
  const z = dx * p.w[0] + dy * p.w[1] + dz * p.w[2]
  const [rx, ry, rz] = p.rad
  const k0 = Math.hypot(x / rx, y / ry, z / rz)
  const k1 = Math.hypot(x / (rx * rx), y / (ry * ry), z / (rz * rz))
  return k1 === 0 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1
}

function smin(a: number, b: number, k: number) {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}
const smax = (a: number, b: number, k: number) => -smin(-a, -b, k)

/** Evaluate the SDF using only the given primitives (kept in sculpt order). */
export function sdfWith(list: Prim[], x: number, y: number, z: number): number {
  let d = 1e9
  for (let i = 0; i < list.length; i++) {
    const p = list[i]
    const dx = Math.max(p.min[0] - x, 0, x - p.max[0])
    const dy = Math.max(p.min[1] - y, 0, y - p.max[1])
    const dz = Math.max(p.min[2] - z, 0, z - p.max[2])
    const bd = Math.sqrt(dx * dx + dy * dy + dz * dz)
    if (p.sub) {
      if (bd > p.k + Math.max(0, -d)) continue
      const pd = p.kind === Kind.Cone ? sdRoundCone(x, y, z, p) : sdEllipsoid(x, y, z, p)
      d = smax(d, -pd, p.k)
    } else {
      if (bd > d + p.k) continue
      const pd = p.kind === Kind.Cone ? sdRoundCone(x, y, z, p) : sdEllipsoid(x, y, z, p)
      d = smin(d, pd, p.k)
    }
  }
  // flatten the soles
  return Math.max(d, -y + 0.003)
}

export const bodySDF = (x: number, y: number, z: number) => sdfWith(prims, x, y, z)

/** Primitives that can influence any point inside the box (grown by `margin`). */
export function primsNear(min: Vec3, max: Vec3, margin = 0.03): Prim[] {
  return prims.filter((p) => {
    const g = p.k + margin
    return p.max[0] + g >= min[0] && p.min[0] - g <= max[0] &&
      p.max[1] + g >= min[1] && p.min[1] - g <= max[1] &&
      p.max[2] + g >= min[2] && p.min[2] - g <= max[2]
  })
}
