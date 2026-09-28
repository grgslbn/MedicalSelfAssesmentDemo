import { BufferAttribute, BufferGeometry } from 'three'
import { computeBoundsTree } from 'three-mesh-bvh'
import { meshPatch, mergeMeshes, shrink, type Box, type MeshData } from './mesher.ts'
import BodyWorker from './body.worker.ts?worker&inline'

const mirror = (b: Box): Box => ({ min: [-b.max[0], b.min[1], b.min[2]], max: [-b.min[0], b.max[1], b.max[2]] })

// Fine patches: head (face), hands (fingers), feet (toes). Left side; mirrored for the right.
const HEAD: Box = { min: [-0.1, 1.49, -0.115], max: [0.1, 1.765, 0.135] }
const HAND: Box = { min: [0.245, 0.675, -0.04], max: [0.39, 0.905, 0.105] }
const FOOT: Box = { min: [0.035, 0, -0.085], max: [0.17, 0.11, 0.165] }
const BODY: Box = { min: [-0.345, 0, -0.15], max: [0.345, 1.77, 0.17] }

/** Mesh the body; `detail` scales every patch's cell size (1 = full detail). */
export function buildBodyArrays(detail = 1): MeshData {
  const H = { body: 0.0085, head: 0.0026, hand: 0.0017, foot: 0.0032 }
  const fine: { box: Box; h: number }[] = [
    { box: HEAD, h: H.head },
    { box: HAND, h: H.hand }, { box: mirror(HAND), h: H.hand },
    { box: FOOT, h: H.foot }, { box: mirror(FOOT), h: H.foot },
  ]
  const overlap = H.body * detail * 2.5
  const parts = [
    meshPatch({
      ...BODY, h: H.body * detail,
      exclude: fine.map((f) => shrink(f.box, overlap)),
      inset: fine.map((f) => f.box),
    }),
    ...fine.map((f) => meshPatch({ ...f.box, h: f.h * detail })),
  ]
  return mergeMeshes(parts)
}

/** Low-poly variant: one coarse, slightly inflated patch with jittered, irregular facets. */
export function buildLowPolyArrays(): MeshData {
  return meshPatch({ ...BODY, h: 0.022, inflate: 0.005, jitter: 0.38 })
}

export type BodyKind = 'detailed' | 'lowpoly'

export function toGeometry({ positions, normals, indices }: MeshData) {
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(positions, 3))
  g.setAttribute('normal', new BufferAttribute(normals, 3))
  g.setIndex(new BufferAttribute(indices, 1))
  g.computeBoundingSphere()
  g.computeBoundingBox()
  // fast raycasts for tap & hover on a dense mesh
  g.boundsTree = computeBoundsTree.call(g)
  return g
}

const pending: Partial<Record<BodyKind, Promise<BufferGeometry>>> = {}

/** Build a body off the main thread (falls back to inline if workers are unavailable). */
export function loadBodyGeometry(kind: BodyKind = 'detailed', detail = 1): Promise<BufferGeometry> {
  const cached = pending[kind]
  if (cached) return cached
  const build = () => (kind === 'lowpoly' ? buildLowPolyArrays() : buildBodyArrays(detail))
  return (pending[kind] = new Promise((resolve) => {
    const inline = () => resolve(toGeometry(build()))
    try {
      const w = new BodyWorker()
      w.onmessage = (e: MessageEvent<MeshData>) => {
        resolve(toGeometry(e.data))
        w.terminate()
      }
      w.onerror = () => { w.terminate(); inline() }
      w.postMessage({ kind, detail })
    } catch {
      inline()
    }
  }))
}
