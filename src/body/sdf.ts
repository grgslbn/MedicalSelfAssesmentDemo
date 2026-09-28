/**
 * A gender-neutral mannequin sculpted from signed-distance primitives.
 * Units are metres; feet rest on y = 0; the figure faces +z.
 * The patient's left side is +x.
 */

type Vec3 = [number, number, number]

interface Prim {
  kind: 'cone' | 'ellipsoid'
  a: Vec3
  b: Vec3 // cone end, or ellipsoid radii
  r1: number
  r2: number
  k: number // blend radius with the rest of the body
  // bounding box (with blend padding) for fast rejection
  min: Vec3
  max: Vec3
}

const prims: Prim[] = []

function bbox(p: Omit<Prim, 'min' | 'max'>): Prim {
  let min: Vec3, max: Vec3
  if (p.kind === 'ellipsoid') {
    min = [p.a[0] - p.b[0], p.a[1] - p.b[1], p.a[2] - p.b[2]]
    max = [p.a[0] + p.b[0], p.a[1] + p.b[1], p.a[2] + p.b[2]]
  } else {
    const r = Math.max(p.r1, p.r2)
    min = [Math.min(p.a[0], p.b[0]) - r, Math.min(p.a[1], p.b[1]) - r, Math.min(p.a[2], p.b[2]) - r]
    max = [Math.max(p.a[0], p.b[0]) + r, Math.max(p.a[1], p.b[1]) + r, Math.max(p.a[2], p.b[2]) + r]
  }
  return { ...p, min, max }
}

function cone(a: Vec3, b: Vec3, r1: number, r2: number, k = 0.03, mirror = false) {
  prims.push(bbox({ kind: 'cone', a, b, r1, r2, k }))
  if (mirror) prims.push(bbox({ kind: 'cone', a: [-a[0], a[1], a[2]], b: [-b[0], b[1], b[2]], r1, r2, k }))
}
function ell(c: Vec3, r: Vec3, k = 0.03, mirror = false) {
  prims.push(bbox({ kind: 'ellipsoid', a: c, b: r, r1: 0, r2: 0, k }))
  if (mirror) prims.push(bbox({ kind: 'ellipsoid', a: [-c[0], c[1], c[2]], b: r, r1: 0, r2: 0, k }))
}

// ── Sculpt ────────────────────────────────────────────────────────────────
// Head & neck
ell([0, 1.635, 0.005], [0.079, 0.104, 0.093], 0.03)
ell([0, 1.575, 0.03], [0.058, 0.058, 0.066], 0.04) // jaw
ell([0, 1.62, 0.088], [0.012, 0.022, 0.014], 0.012) // nose hint
cone([0, 1.46, -0.005], [0, 1.56, -0.005], 0.05, 0.043, 0.03)
// Torso
ell([0, 1.335, 0.0], [0.148, 0.145, 0.098], 0.05) // ribcage
ell([0, 1.3, 0.035], [0.12, 0.08, 0.075], 0.04) // chest front
cone([0.04, 1.43, -0.01], [0.175, 1.41, -0.008], 0.052, 0.05, 0.05, true) // trapezius → shoulder
ell([0.185, 1.395, -0.005], [0.058, 0.055, 0.058], 0.035, true) // deltoid
ell([0, 1.13, 0.005], [0.118, 0.13, 0.085], 0.07) // waist
ell([0, 0.965, -0.005], [0.148, 0.105, 0.098], 0.06) // pelvis
ell([0.068, 0.925, -0.045], [0.072, 0.08, 0.07], 0.04, true) // glutes
// Arms (relaxed A-pose so every zone is easy to tap)
cone([0.2, 1.385, -0.01], [0.245, 1.135, -0.02], 0.047, 0.036, 0.03, true)
cone([0.245, 1.135, -0.02], [0.292, 0.9, 0.018], 0.036, 0.027, 0.02, true)
ell([0.262, 1.04, -0.005], [0.036, 0.075, 0.038], 0.03, true) // forearm muscle
ell([0.302, 0.835, 0.03], [0.02, 0.058, 0.04], 0.025, true) // hand
cone([0.29, 0.865, 0.06], [0.285, 0.815, 0.078], 0.012, 0.009, 0.015, true) // thumb
// Legs
cone([0.083, 0.93, 0.0], [0.095, 0.515, 0.008], 0.085, 0.05, 0.05, true)
ell([0.096, 0.495, 0.018], [0.047, 0.05, 0.05], 0.03, true) // knee
cone([0.096, 0.48, 0.0], [0.1, 0.085, -0.012], 0.047, 0.03, 0.03, true)
ell([0.098, 0.37, -0.028], [0.043, 0.085, 0.042], 0.04, true) // calf
cone([0.1, 0.05, -0.025], [0.108, 0.026, 0.115], 0.042, 0.024, 0.03, true) // foot

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
  const x = px - p.a[0], y = py - p.a[1], z = pz - p.a[2]
  const [rx, ry, rz] = p.b
  const k0 = Math.hypot(x / rx, y / ry, z / rz)
  const k1 = Math.hypot(x / (rx * rx), y / (ry * ry), z / (rz * rz))
  return k1 === 0 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1
}

function smin(a: number, b: number, k: number) {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}

export function bodySDF(x: number, y: number, z: number): number {
  let d = 1e9
  for (let i = 0; i < prims.length; i++) {
    const p = prims[i]
    // Box distance lower bound — skip primitives that can't affect the blend.
    const dx = Math.max(p.min[0] - x, 0, x - p.max[0])
    const dy = Math.max(p.min[1] - y, 0, y - p.max[1])
    const dz = Math.max(p.min[2] - z, 0, z - p.max[2])
    const bd = Math.sqrt(dx * dx + dy * dy + dz * dz)
    if (bd > d + p.k) continue
    const pd = p.kind === 'cone' ? sdRoundCone(x, y, z, p) : sdEllipsoid(x, y, z, p)
    d = smin(d, pd, p.k)
  }
  // flatten the soles
  return Math.max(d, -y + 0.004)
}

/** Grid extents used to mesh the body (world units). */
export const GRID = {
  center: [0, 0.9, 0.0] as Vec3,
  half: [0.4, 0.93, 0.2] as Vec3,
}

export interface BodyMesh {
  positions: Float32Array
  normals: Float32Array
}

/**
 * Fill a cubic field for three's MarchingCubes. The grid is stretched non-uniformly
 * to fit the tall, narrow figure, so each axis gets its own world-space step.
 * Blocks of B³ voxels far from the surface are filled from a single sample.
 */
export function fillField(field: Float32Array, size: number) {
  const hs = size / 2
  const [cx, cy, cz] = GRID.center
  const [hx, hy, hz] = GRID.half
  const sx = hx / hs, sy = hy / hs, sz = hz / hs
  const B = 4
  const halfDiag = 0.5 * B * Math.hypot(sx, sy, sz)
  const margin = halfDiag + 1.6 * Math.max(sx, sy, sz)
  const size2 = size * size
  const clamp = (d: number) => Math.max(-0.05, Math.min(0.05, -d))
  for (let bz = 0; bz < size; bz += B) {
    for (let by = 0; by < size; by += B) {
      for (let bx = 0; bx < size; bx += B) {
        const mx = cx + ((bx + B / 2 - 0.5 - hs) / hs) * hx
        const my = cy + ((by + B / 2 - 0.5 - hs) / hs) * hy
        const mz = cz + ((bz + B / 2 - 0.5 - hs) / hs) * hz
        const dc = bodySDF(mx, my, mz)
        const far = Math.abs(dc) > margin
        const ze = Math.min(bz + B, size), ye = Math.min(by + B, size), xe = Math.min(bx + B, size)
        for (let zi = bz; zi < ze; zi++) {
          const z = cz + ((zi - hs) / hs) * hz
          for (let yi = by; yi < ye; yi++) {
            const y = cy + ((yi - hs) / hs) * hy
            let idx = zi * size2 + yi * size + bx
            for (let xi = bx; xi < xe; xi++, idx++) {
              field[idx] = far ? clamp(dc) : clamp(bodySDF(cx + ((xi - hs) / hs) * hx, y, z))
            }
          }
        }
      }
    }
  }
}
