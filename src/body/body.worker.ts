import { buildBodyArrays } from './buildBody.ts'

self.onmessage = (e: MessageEvent<{ detail: number }>) => {
  const m = buildBodyArrays(e.data.detail)
  ;(self as unknown as Worker).postMessage(m, [m.positions.buffer, m.normals.buffer, m.indices.buffer])
}
