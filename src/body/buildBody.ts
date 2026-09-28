import { BufferAttribute, BufferGeometry, MeshBasicMaterial } from 'three'
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js'
import { fillField, GRID } from './sdf.ts'
import BodyWorker from './body.worker.ts?worker&inline'

/** Mesh the SDF body with marching cubes; returns world-space positions & normals. */
export function buildBodyArrays(resolution = 112) {
  const mc = new MarchingCubes(resolution, new MeshBasicMaterial(), false, false, 200000)
  mc.isolation = 0
  fillField(mc.field, resolution)
  mc.update()

  const n = mc.count
  const [cx, cy, cz] = GRID.center
  const [hx, hy, hz] = GRID.half
  const positions = new Float32Array(n * 3)
  const normals = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const j = i * 3
    positions[j] = cx + mc.positionArray[j] * hx
    positions[j + 1] = cy + mc.positionArray[j + 1] * hy
    positions[j + 2] = cz + mc.positionArray[j + 2] * hz
    // the gradient lives in grid space: map it with the inverse-transpose of the stretch
    const nx = mc.normalArray[j] / hx
    const ny = mc.normalArray[j + 1] / hy
    const nz = mc.normalArray[j + 2] / hz
    const l = Math.hypot(nx, ny, nz) || 1
    normals[j] = nx / l
    normals[j + 1] = ny / l
    normals[j + 2] = nz / l
  }
  mc.geometry.dispose()
  return { positions, normals }
}

export function toGeometry(positions: Float32Array, normals: Float32Array) {
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(positions, 3))
  g.setAttribute('normal', new BufferAttribute(normals, 3))
  g.computeBoundingSphere()
  g.computeBoundingBox()
  return g
}

let pending: Promise<BufferGeometry> | null = null

/** Build the body off the main thread (falls back to inline if workers are unavailable). */
export function loadBodyGeometry(resolution = 112): Promise<BufferGeometry> {
  if (pending) return pending
  pending = new Promise((resolve) => {
    try {
      const w = new BodyWorker()
      w.onmessage = (e: MessageEvent<{ positions: Float32Array; normals: Float32Array }>) => {
        resolve(toGeometry(e.data.positions, e.data.normals))
        w.terminate()
      }
      w.onerror = () => {
        w.terminate()
        const a = buildBodyArrays(resolution)
        resolve(toGeometry(a.positions, a.normals))
      }
      w.postMessage({ resolution })
    } catch {
      const a = buildBodyArrays(resolution)
      resolve(toGeometry(a.positions, a.normals))
    }
  })
  return pending
}
