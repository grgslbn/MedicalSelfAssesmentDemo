import { buildBodyArrays } from './buildBody.ts'

self.onmessage = (e: MessageEvent<{ resolution: number }>) => {
  const { positions, normals } = buildBodyArrays(e.data.resolution)
  ;(self as unknown as Worker).postMessage({ positions, normals }, [positions.buffer, normals.buffer])
}
