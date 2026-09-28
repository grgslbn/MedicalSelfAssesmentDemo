/**
 * V0.2 anatomy preview: loads the lean BodyParts3D package built by
 * scripts/extract-anatomy.mts (public/anatomy/*).
 * Anatomy data: BodyParts3D 4.0, © The Database Center for Life Science, CC BY 4.0.
 */
import { BufferAttribute, BufferGeometry } from 'three'
import { computeBoundsTree } from 'three-mesh-bvh'

export type AnatomyLayer = 'bones' | 'organs' | 'muscles'
export const LAYERS: AnatomyLayer[] = ['bones', 'organs', 'muscles']

export interface Structure { id: number; label: string; layer: AnatomyLayer; zones: string[]; side: 'L' | 'R' | 'C'; color: string; approx?: boolean }
interface LayerInfo { file: string; bytes: number; vertexCount: number; indexCount: number; min: number[]; max: number[]; offsets: { position: number; normal: number; sid: number; index: number } }
interface Manifest { version: string; layers: Record<AnatomyLayer, LayerInfo>; structures: Structure[] }

export interface AnatomyData { structures: Structure[]; geometries: Record<AnatomyLayer, BufferGeometry> }

const BASE = `${import.meta.env.BASE_URL}anatomy/`

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

async function fetchWithProgress(url: string, bytes: number, onBytes: (n: number) => void): Promise<ArrayBuffer> {
  const res = await fetch(url)
  if (!res.ok || !res.body) throw new Error(`Could not load ${url}`)
  const reader = res.body.getReader()
  const out = new Uint8Array(bytes)
  let at = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (at + value.length > out.length) throw new Error('Unexpected anatomy file size')
    out.set(value, at)
    at += value.length
    onBytes(value.length)
  }
  if (at !== bytes) throw new Error('Anatomy file was incomplete')
  return out.buffer
}

function decode(buf: ArrayBuffer, info: LayerInfo, structures: Structure[]): BufferGeometry {
  const { vertexCount: nv, indexCount: ni, min, max, offsets: o } = info
  const q = new Int16Array(buf, o.position, nv * 3)
  const pos = new Float32Array(nv * 3)
  for (let i = 0; i < pos.length; i++) {
    const k = i % 3
    pos[i] = min[k] + ((q[i] + 32768) / 65535) * (max[k] - min[k])
  }
  const sid = new Uint16Array(buf, o.sid, nv)
  const sidF = Float32Array.from(sid)
  const col = new Uint8Array(nv * 3)
  const rgb = structures.map((s) => hexToRgb(s.color))
  for (let v = 0; v < nv; v++) col.set(rgb[sid[v]], v * 3)
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(pos, 3))
  g.setAttribute('normal', new BufferAttribute(new Int8Array(buf, o.normal, nv * 3), 3, true))
  g.setAttribute('color', new BufferAttribute(col, 3, true))
  g.setAttribute('sid', new BufferAttribute(sidF, 1))
  g.setIndex(new BufferAttribute(new Uint32Array(buf, o.index, ni), 1))
  g.computeBoundingSphere()
  g.boundsTree = computeBoundsTree.call(g)
  return g
}

let pending: Promise<AnatomyData> | null = null

/** Load (once) the anatomy package; reports progress 0..1. */
export function loadAnatomy(onProgress: (p: number) => void = () => {}): Promise<AnatomyData> {
  if (pending) return pending
  pending = (async () => {
    const manifest: Manifest = await (await fetch(`${BASE}anatomy.json`)).json()
    const total = LAYERS.reduce((s, l) => s + manifest.layers[l].bytes, 0)
    let got = 0
    const bufs = await Promise.all(LAYERS.map((l) =>
      fetchWithProgress(BASE + manifest.layers[l].file, manifest.layers[l].bytes, (n) => { got += n; onProgress(got / total) })))
    const geometries = Object.fromEntries(LAYERS.map((l, i) => [l, decode(bufs[i], manifest.layers[l], manifest.structures)])) as Record<AnatomyLayer, BufferGeometry>
    return { structures: manifest.structures, geometries }
  })()
  pending.catch(() => { pending = null })
  return pending
}

export const ANATOMY_CREDIT = 'Anatomy: BodyParts3D © DBCLS, CC BY 4.0'
