/**
 * Sparse, multi-resolution surface nets.
 *
 * The body is meshed as a coarse patch plus fine patches (head, hands, feet).
 * Every vertex is projected onto the true SDF surface and shaded with the
 * analytic gradient, so overlapping patches coincide and seams disappear.
 * Inside a fine patch the coarse surface is pushed a hair inwards so the
 * fine surface always wins the depth test.
 */
import { primsNear, sdfWith, type Prim, type Vec3 } from './sdf.ts'

export interface Box { min: Vec3; max: Vec3 }
export interface Patch extends Box {
  h: number
  /** skip cells whose centre lies inside these boxes */
  exclude?: Box[]
  /** push vertices inside these boxes slightly below the surface */
  inset?: Box[]
  /** grow the surface outwards by this many metres (fuses thin parts) */
  inflate?: number
  /** randomly offset cell vertices by this fraction of a cell (irregular facets) */
  jitter?: number
  /** mesh these primitives instead of the body sculpt */
  source?: Prim[]
}
export interface MeshData { positions: Float32Array; normals: Float32Array; indices: Uint32Array }

const inside = (b: Box, x: number, y: number, z: number) =>
  x > b.min[0] && x < b.max[0] && y > b.min[1] && y < b.max[1] && z > b.min[2] && z < b.max[2]

/** Deterministic 0..1 hash so the facets look the same on every load. */
function hash(n: number) {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b)
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296
}

export function shrink(b: Box, m: number): Box {
  return { min: [b.min[0] + m, b.min[1] + m, b.min[2] + m], max: [b.max[0] - m, b.max[1] - m, b.max[2] - m] }
}

export function meshPatch(patch: Patch): MeshData {
  const { min, max, h } = patch
  const inflate = patch.inflate ?? 0
  const sdf = (list: Prim[], x: number, y: number, z: number) => sdfWith(list, x, y, z) - inflate
  const nx = Math.ceil((max[0] - min[0]) / h) + 1
  const ny = Math.ceil((max[1] - min[1]) / h) + 1
  const nz = Math.ceil((max[2] - min[2]) / h) + 1
  const sxy = nx * ny
  const field = new Float32Array(nx * ny * nz)
  const px = (i: number) => min[0] + i * h
  const py = (j: number) => min[1] + j * h
  const pz = (k: number) => min[2] + k * h

  // ── 1. sparse field: super-blocks → blocks → points ───────────────────
  const S = 16, B = 4
  const nbx = Math.ceil(nx / B), nby = Math.ceil(ny / B)
  const blockLists: (Prim[] | undefined)[] = []
  const blockId = (i: number, j: number, k: number) => ((k / B) | 0) * nbx * nby + ((j / B) | 0) * nbx + ((i / B) | 0)

  for (let sk = 0; sk < nz; sk += S) for (let sj = 0; sj < ny; sj += S) for (let si = 0; si < nx; si += S) {
    const ek = Math.min(sk + S, nz) - 1, ej = Math.min(sj + S, ny) - 1, ei = Math.min(si + S, nx) - 1
    const smin: Vec3 = [px(si), py(sj), pz(sk)], smax: Vec3 = [px(ei), py(ej), pz(ek)]
    const sList = primsNear(smin, smax, 0.03, patch.source)
    for (let bk = sk; bk <= ek; bk += B) for (let bj = sj; bj <= ej; bj += B) for (let bi = si; bi <= ei; bi += B) {
      const ck = Math.min(bk + B, ek + 1) - 1, cj = Math.min(bj + B, ej + 1) - 1, ci = Math.min(bi + B, ei + 1) - 1
      const bmin: Vec3 = [px(bi), py(bj), pz(bk)], bmax: Vec3 = [px(ci), py(cj), pz(ck)]
      const list = sList.length ? sList.filter((p) => {
        const g = p.k + 0.03
        return p.max[0] + g >= bmin[0] && p.min[0] - g <= bmax[0] && p.max[1] + g >= bmin[1] &&
          p.min[1] - g <= bmax[1] && p.max[2] + g >= bmin[2] && p.min[2] - g <= bmax[2]
      }) : sList
      blockLists[blockId(bi, bj, bk)] = list
      const cx = (bmin[0] + bmax[0]) / 2, cy = (bmin[1] + bmax[1]) / 2, cz = (bmin[2] + bmax[2]) / 2
      const halfDiag = 0.5 * Math.hypot(bmax[0] - bmin[0], bmax[1] - bmin[1], bmax[2] - bmin[2])
      const dc = list.length ? sdf(list, cx, cy, cz) : 1
      const far = Math.abs(dc) > halfDiag + h
      for (let k = bk; k <= ck; k++) for (let j = bj; j <= cj; j++) {
        let idx = k * sxy + j * nx + bi
        for (let i = bi; i <= ci; i++, idx++) field[idx] = far ? dc : sdf(list, px(i), py(j), pz(k))
      }
    }
  }

  // ── 2. one vertex per surface cell ────────────────────────────────────
  const cx1 = nx - 1, cy1 = ny - 1, cz1 = nz - 1
  const cellVert = new Int32Array(cx1 * cy1 * cz1).fill(-1)
  const verts: number[] = []
  const vBlock: number[] = []
  const corner = new Float32Array(8)
  const CE = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]]
  const off = [0, 1, nx, nx + 1, sxy, sxy + 1, sxy + nx, sxy + nx + 1]
  for (let k = 0; k < cz1; k++) for (let j = 0; j < cy1; j++) for (let i = 0; i < cx1; i++) {
    const base = k * sxy + j * nx + i
    let mask = 0
    for (let c = 0; c < 8; c++) { corner[c] = field[base + off[c]]; if (corner[c] < 0) mask |= 1 << c }
    if (mask === 0 || mask === 255) continue
    const ccx = px(i) + h / 2, ccy = py(j) + h / 2, ccz = pz(k) + h / 2
    if (patch.exclude?.some((b) => inside(b, ccx, ccy, ccz))) continue
    let ax = 0, ay = 0, az = 0, n = 0
    for (const [a, b] of CE) {
      const fa = corner[a], fb = corner[b]
      if ((fa < 0) === (fb < 0)) continue
      const t = fa / (fa - fb)
      const xa = a & 1, ya = (a >> 1) & 1, za = (a >> 2) & 1
      const xb = b & 1, yb = (b >> 1) & 1, zb = (b >> 2) & 1
      ax += xa + (xb - xa) * t; ay += ya + (yb - ya) * t; az += za + (zb - za) * t; n++
    }
    cellVert[k * cx1 * cy1 + j * cx1 + i] = verts.length / 3
    let jx = 0, jy = 0, jz = 0
    if (patch.jitter) {
      const c = i * 73856093 ^ j * 19349663 ^ k * 83492791
      jx = (hash(c) - 0.5) * patch.jitter; jy = (hash(c + 1) - 0.5) * patch.jitter; jz = (hash(c + 2) - 0.5) * patch.jitter
    }
    verts.push(px(i) + (ax / n + jx) * h, py(j) + (ay / n + jy) * h, pz(k) + (az / n + jz) * h)
    vBlock.push(blockId(i, j, k))
  }

  // ── 3. project onto the true surface; analytic normals ────────────────
  const nv = verts.length / 3
  const positions = new Float32Array(verts)
  const normals = new Float32Array(nv * 3)
  const e = h * 0.2
  for (let v = 0; v < nv; v++) {
    const list = blockLists[vBlock[v]] ?? []
    let x = positions[v * 3], y = positions[v * 3 + 1], z = positions[v * 3 + 2]
    let gx = 0, gy = 1, gz = 0
    for (let it = 0; it < 3; it++) {
      const d = sdf(list, x, y, z)
      gx = sdf(list, x + e, y, z) - sdf(list, x - e, y, z)
      gy = sdf(list, x, y + e, z) - sdf(list, x, y - e, z)
      gz = sdf(list, x, y, z + e) - sdf(list, x, y, z - e)
      const gl = Math.hypot(gx, gy, gz) || 1
      gx /= gl; gy /= gl; gz /= gl
      if (it === 2) break
      const step = Math.max(-h, Math.min(h, d))
      x -= gx * step; y -= gy * step; z -= gz * step
    }
    if (patch.inset?.some((b) => inside(b, x, y, z))) { x -= gx * 0.0006; y -= gy * 0.0006; z -= gz * 0.0006 }
    positions[v * 3] = x; positions[v * 3 + 1] = y; positions[v * 3 + 2] = z
    normals[v * 3] = gx; normals[v * 3 + 1] = gy; normals[v * 3 + 2] = gz
  }

  // ── 4. quads across every sign-changing grid edge ─────────────────────
  const idx: number[] = []
  const cv = (i: number, j: number, k: number) =>
    i < 0 || j < 0 || k < 0 || i >= cx1 || j >= cy1 || k >= cz1 ? -1 : cellVert[k * cx1 * cy1 + j * cx1 + i]
  const quad = (a: number, b: number, c: number, d: number) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return
    // pick the winding that agrees with the surface normal
    const P = positions, N = normals
    const e1x = P[c * 3] - P[a * 3], e1y = P[c * 3 + 1] - P[a * 3 + 1], e1z = P[c * 3 + 2] - P[a * 3 + 2]
    const e2x = P[d * 3] - P[b * 3], e2y = P[d * 3 + 1] - P[b * 3 + 1], e2z = P[d * 3 + 2] - P[b * 3 + 2]
    const fx = e1y * e2z - e1z * e2y, fy = e1z * e2x - e1x * e2z, fz = e1x * e2y - e1y * e2x
    const nx_ = N[a * 3] + N[b * 3] + N[c * 3] + N[d * 3]
    const ny_ = N[a * 3 + 1] + N[b * 3 + 1] + N[c * 3 + 1] + N[d * 3 + 1]
    const nz_ = N[a * 3 + 2] + N[b * 3 + 2] + N[c * 3 + 2] + N[d * 3 + 2]
    if (fx * nx_ + fy * ny_ + fz * nz_ < 0) { const t = b; b = d; d = t }
    // split along the shorter diagonal
    const dac = (P[a * 3] - P[c * 3]) ** 2 + (P[a * 3 + 1] - P[c * 3 + 1]) ** 2 + (P[a * 3 + 2] - P[c * 3 + 2]) ** 2
    const dbd = (P[b * 3] - P[d * 3]) ** 2 + (P[b * 3 + 1] - P[d * 3 + 1]) ** 2 + (P[b * 3 + 2] - P[d * 3 + 2]) ** 2
    if (dac < dbd) idx.push(a, b, c, a, c, d)
    else idx.push(a, b, d, b, c, d)
  }
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const p = k * sxy + j * nx + i
    const s = field[p] < 0
    if (i < cx1 && s !== field[p + 1] < 0) quad(cv(i, j - 1, k - 1), cv(i, j, k - 1), cv(i, j, k), cv(i, j - 1, k))
    if (j < cy1 && s !== field[p + nx] < 0) quad(cv(i - 1, j, k - 1), cv(i, j, k - 1), cv(i, j, k), cv(i - 1, j, k))
    if (k < cz1 && s !== field[p + sxy] < 0) quad(cv(i - 1, j - 1, k), cv(i, j - 1, k), cv(i, j, k), cv(i - 1, j, k))
  }

  return { positions, normals, indices: new Uint32Array(idx) }
}

export function mergeMeshes(parts: MeshData[]): MeshData {
  const nv = parts.reduce((s, p) => s + p.positions.length, 0)
  const ni = parts.reduce((s, p) => s + p.indices.length, 0)
  const positions = new Float32Array(nv), normals = new Float32Array(nv), indices = new Uint32Array(ni)
  let vo = 0, io = 0
  for (const p of parts) {
    positions.set(p.positions, vo)
    normals.set(p.normals, vo)
    const base = vo / 3
    for (let i = 0; i < p.indices.length; i++) indices[io + i] = p.indices[i] + base
    vo += p.positions.length
    io += p.indices.length
  }
  return { positions, normals, indices }
}
