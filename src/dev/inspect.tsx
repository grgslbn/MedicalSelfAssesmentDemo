/**
 * Dev-only close-up viewer for the sculpt: /inspect.html?view=face|hand|foot|full|back&glass&poly
 * Not part of the production build.
 */
import { createRoot } from 'react-dom/client'
import { Canvas } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls } from '@react-three/drei'
import { useEffect, useMemo, useState } from 'react'
import type { BufferGeometry } from 'three'
import { loadBodyGeometry } from '../body/buildBody'
import { createBodyMaterial } from '../body/bodyMaterial'

const q = new URLSearchParams(location.search)
const VIEWS: Record<string, { target: [number, number, number]; pos: [number, number, number] }> = {
  face: { target: [0, 1.62, 0.04], pos: [0.12, 1.66, 0.5] },
  profile: { target: [0, 1.62, 0.02], pos: [0.5, 1.64, 0.1] },
  hand: { target: [0.31, 0.8, 0.03], pos: [0.62, 0.84, 0.32] },
  palm: { target: [0.31, 0.8, 0.03], pos: [-0.05, 0.84, 0.3] },
  foot: { target: [0.1, 0.05, 0.05], pos: [0.3, 0.3, 0.55] },
  full: { target: [0, 0.9, 0], pos: [0, 1.0, 4.2] },
  back: { target: [0, 1.1, 0], pos: [0, 1.2, -2.6] },
}
const view = VIEWS[q.get('view') ?? 'full']

function Body() {
  const [geo, setGeo] = useState<BufferGeometry | null>(null)
  const { mat, uniforms } = useMemo(createBodyMaterial, [])
  useEffect(() => {
    if (q.has('glass')) { mat.transmission = 1; mat.roughness = 0.16; mat.color.set('#f7faff'); uniforms.uRimAmt.value = 0.55 }
    if (q.has('poly')) { mat.flatShading = true; mat.roughness = 0.85; mat.sheen = 0; mat.color.set('#d8d0c6'); mat.needsUpdate = true }
    loadBodyGeometry(q.has('poly') ? 'lowpoly' : 'detailed').then((g) => {
      setGeo(g)
      const t = g.index!.count / 3
      document.title = `ready ${t} tris`
    })
  }, [mat, uniforms])
  return geo ? <mesh geometry={geo} material={mat} /> : null
}

createRoot(document.getElementById('root')!).render(
  <Canvas camera={{ fov: 30, position: view.pos, near: 0.01 }} dpr={[1, 2]}>
    <color attach="background" args={['#efe9e1']} />
    <hemisphereLight args={['#fff8ef', '#c9b8a6', 0.55]} />
    <directionalLight position={[-2.2, 3.4, 2.6]} intensity={2.4} color="#fff0de" />
    <directionalLight position={[2.6, 1.8, -2.4]} intensity={0.9} color="#dfe9ff" />
    <Environment resolution={256} frames={1}>
      <Lightformer form="rect" intensity={2.2} position={[-3, 3, 3]} scale={[4, 3, 1]} color="#fff4ea" />
      <Lightformer form="rect" intensity={1.4} position={[3, 1.5, 2]} scale={[2, 4, 1]} color="#e9f1ff" />
      <Lightformer form="rect" intensity={2.4} position={[0, 2, -4]} scale={[6, 2, 1]} color="#ffffff" />
    </Environment>
    <Body />
    <OrbitControls target={view.target} />
  </Canvas>,
)
