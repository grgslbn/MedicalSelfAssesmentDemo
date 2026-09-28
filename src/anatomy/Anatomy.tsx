import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { acceleratedRaycast } from 'three-mesh-bvh'
import { useStore } from '../state/store'
import { LAYERS, loadAnatomy, type AnatomyData, type AnatomyLayer } from './data'
import { regionAt } from '../data/regions'

/** Shared, mutable effect state between the body and the anatomy (read every frame). */
export const anatomyFx = {
  win: new THREE.Vector4(0, 0, 0, 0), // skin window: local centre + radius
  reveal: 0, // 0..1 how visible the anatomy is
  data: null as AnatomyData | null,
}

export const structuresInZone = (zone: string) => anatomyFx.data?.structures.filter((s) => s.zones.includes(zone)) ?? []

/**
 * The structures to offer for a zone: one per name, on the side that was tapped
 * (patient's left is +x), labelled "(left)"/"(right)" in central zones like the chest.
 */
export function pickList(zone: string, tapX: number | undefined) {
  const all = structuresInZone(zone)
  const want = tapX === undefined ? null : tapX >= 0 ? 'L' : 'R'
  const central = !/[LR]$/.test(zone)
  const byLabel = new Map<string, typeof all>()
  for (const s of all) byLabel.set(s.label, [...(byLabel.get(s.label) ?? []), s])
  return [...byLabel.values()].map((group) => {
    const st = group.find((s) => s.side === want) ?? group.find((s) => s.side === 'C') ?? group[0]
    const suffix = central && group.length > 1 && st.side !== 'C' ? (st.side === 'L' ? ' (left)' : ' (right)') : ''
    return { ...st, label: st.label + suffix }
  })
}

const STATE_W = 256

function makeMaterial(state: THREE.DataTexture, shared: { uReveal: { value: number }; uTime: { value: number }; uWinOnly: { value: number }; uAccent: { value: THREE.Color } }) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.52, metalness: 0.02, transparent: true })
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, shared, { uState: { value: state }, uWin: { value: anatomyFx.win } })
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float sid;\nvarying float vSid;\nvarying vec3 vLocalA;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSid = sid;\nvLocalA = position;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D uState; uniform float uReveal; uniform float uTime; uniform float uWinOnly;
        uniform vec4 uWin; uniform vec3 uAccent;
        varying float vSid; varying vec3 vLocalA;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        // only what sits inside the skin window is drawn in window mode
        if (uWinOnly > 0.5 && length(vLocalA - uWin.xyz) > uWin.w + 0.02) discard;
        vec4 st = texture2D(uState, vec2((vSid + 0.5) / ${STATE_W.toFixed(1)}, 0.5));
        float emph = st.r; float hi = st.g;
        vec3 grey = vec3(dot(diffuseColor.rgb, vec3(0.3333))) * 0.9;
        diffuseColor.rgb = mix(grey, diffuseColor.rgb, 0.3 + 0.7 * emph);
        diffuseColor.a *= uReveal * (0.45 + 0.55 * emph) * st.b;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += uAccent * hi * (0.45 + 0.2 * sin(uTime * 3.0));`)
  }
  mat.customProgramCacheKey = () => 'soma-anatomy'
  return mat
}

export function Anatomy() {
  const enabled = useStore((s) => s.anatomyPreview)
  const layers = useStore((s) => s.anatomyLayers)
  const set = useStore((s) => s.set)
  const select = useStore((s) => s.select)
  const [data, setData] = useState<AnatomyData | null>(anatomyFx.data)

  useEffect(() => {
    if (!enabled || data) return
    let alive = true
    loadAnatomy((p) => set({ anatomyProgress: Math.min(0.99, p) }))
      .then((d) => { if (!alive) return; anatomyFx.data = d; setData(d); set({ anatomyProgress: 1 }) })
      .catch(() => set({ anatomyProgress: 0, anatomyPreview: false }))
    return () => { alive = false }
  }, [enabled, data, set])

  const state = useMemo(() => {
    const t = new THREE.DataTexture(new Uint8Array(STATE_W * 4), STATE_W, 1, THREE.RGBAFormat)
    t.needsUpdate = true
    return t
  }, [])
  const shared = useMemo(() => ({ uReveal: { value: 0 }, uTime: { value: 0 }, uWinOnly: { value: 0 }, uAccent: { value: new THREE.Color('#3f9c89') } }), [])
  const mats = useMemo(() => Object.fromEntries(LAYERS.map((l) => [l, makeMaterial(state, shared)])) as Record<AnatomyLayer, THREE.MeshStandardMaterial>, [state, shared])
  const [hover, setHover] = useState<number | null>(null)

  useFrame(({ clock }, dt) => {
    const s = useStore.getState()
    const windowOpen = anatomyFx.win.w > 0.001
    const goal = enabled && data && (s.xray || windowOpen) ? 1 : 0
    anatomyFx.reveal = s.reducedMotion ? goal : THREE.MathUtils.damp(anatomyFx.reveal, goal, 5, dt)
    shared.uReveal.value = anatomyFx.reveal
    shared.uTime.value = clock.elapsedTime
    shared.uWinOnly.value = !s.xray && windowOpen ? 1 : 0
    if (!data) return
    const zone = s.selected && s.selected !== 'general' ? s.selected : null
    const px = state.image.data as Uint8Array
    for (const st of data.structures) {
      const i = st.id * 4
      px[i] = !zone || st.zones.includes(zone) ? 255 : 70
      px[i + 1] = st.id === s.focusStructure || st.id === hover ? 255 : 0
      px[i + 2] = st.approx ? 120 : 255 // approximate organs stay translucent
    }
    state.needsUpdate = true
  })

  if (!enabled || !data) return null

  const sidAt = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
    const a = e.face?.a
    const attr = (e.object as THREE.Mesh).geometry.getAttribute('sid')
    return a === undefined || !attr ? null : Math.round(attr.getX(a))
  }
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (anatomyFx.reveal < 0.5) return
    const sid = sidAt(e)
    if (sid === null) return
    e.stopPropagation()
    const st = data.structures[sid]
    const s = useStore.getState()
    const n = e.face?.normal ?? new THREE.Vector3(0, 0, 1)
    const local = e.object.parent ? e.object.parent.worldToLocal(e.point.clone()) : e.point
    // the zone under the finger, as long as this structure belongs to it
    const here = regionAt([local.x, local.y, local.z]).id
    const zone = st.zones.includes(here) ? here : st.zones[0]
    if (s.selected !== zone) select(zone, { point: [local.x, local.y, local.z], normal: [n.x, n.y, n.z] })
    set({ focusStructure: sid })
  }
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (e.pointerType !== 'mouse' || anatomyFx.reveal < 0.5) return
    e.stopPropagation()
    const sid = sidAt(e)
    if (sid !== hover) setHover(sid)
    set({ hovered: sid === null ? null : data.structures[sid].zones[0], hoverText: sid === null ? null : data.structures[sid].label })
  }
  const onOut = () => { setHover(null); set({ hoverText: null }) }

  return (
    <group>
      {LAYERS.map((l) => (
        <mesh key={l} geometry={data.geometries[l]} material={mats[l]} visible={layers[l]} raycast={acceleratedRaycast}
          userData={{ anatomy: true }} renderOrder={1} onClick={onClick} onPointerMove={onMove} onPointerOut={onOut} />
      ))}
    </group>
  )
}
