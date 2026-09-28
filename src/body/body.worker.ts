import { buildBodyArrays, buildLowPolyArrays, type BodyKind } from './buildBody.ts'

self.onmessage = (e: MessageEvent<{ kind: BodyKind; detail: number }>) => {
  const m = e.data.kind === 'lowpoly' ? buildLowPolyArrays() : buildBodyArrays(e.data.detail)
  ;(self as unknown as Worker).postMessage(m, [m.positions.buffer, m.normals.buffer, m.indices.buffer])
}
