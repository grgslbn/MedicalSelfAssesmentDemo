import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { acceleratedRaycast } from 'three-mesh-bvh'
import { loadBodyGeometry } from './buildBody'
import { Anatomy, anatomyFx, structuresInZone } from '../anatomy/Anatomy'
import { createBodyMaterial } from './bodyMaterial'
import { REGIONS, REGION_INDEX, regionAt, regionById, regionCenter } from '../data/regions'
import { useStore } from '../state/store'
import { intensityColor } from '../ui/colors'
import { useIsDark, useIsWide } from '../ui/hooks'

const FOV = 30
const HOME_TARGET = new THREE.Vector3(0, 0.9, 0)

/** Critically-damped ease toward a target; frame-rate independent. */
const damp = THREE.MathUtils.damp

function angleDamp(cur: number, goal: number, lambda: number, dt: number) {
  let d = goal - cur
  d = Math.atan2(Math.sin(d), Math.cos(d))
  return cur + d * (1 - Math.exp(-lambda * dt))
}

// ── Palettes for the 3D world ────────────────────────────────────────────
const WORLD = {
  light: { top: '#f8f5f0', bottom: '#e8e1d7', floor: '#d9cfc2', clay: '#e6d4c2', glass: '#f7faff', poly: '#ddd4ca', edge: '#1c2230', edgeA: 0.075, rim: '#ffffff', accent: '#3f9c89', shadow: '#6b5a48' },
  dark: { top: '#1a2029', bottom: '#0a0d11', floor: '#12161c', clay: '#d6c3b0', glass: '#dbe9ff', poly: '#9aa6b6', edge: '#7fe3ff', edgeA: 0.2, rim: '#9bd7ff', accent: '#5cc7ae', shadow: '#000000' },
}

function Backdrop({ dark }: { dark: boolean }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: { uTop: { value: new THREE.Color() }, uBottom: { value: new THREE.Color() } },
        vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 uTop; uniform vec3 uBottom; varying vec3 vP;
          void main(){ float h = normalize(vP).y; float t = smoothstep(-0.25, 0.6, h);
            gl_FragColor = vec4(mix(uBottom, uTop, t), 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    [],
  )
  const goal = dark ? WORLD.dark : WORLD.light
  const top = useMemo(() => new THREE.Color(), [])
  const bottom = useMemo(() => new THREE.Color(), [])
  useFrame((_, dt) => {
    top.set(goal.top); bottom.set(goal.bottom)
    mat.uniforms.uTop.value.lerp(top, 1 - Math.exp(-4 * dt))
    mat.uniforms.uBottom.value.lerp(bottom, 1 - Math.exp(-4 * dt))
  })
  useEffect(() => {
    mat.uniforms.uTop.value.set(goal.top)
    mat.uniforms.uBottom.value.set(goal.bottom)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <mesh material={mat} position={[0, 0.9, 0]} renderOrder={-1}>
      <sphereGeometry args={[14, 32, 16]} />
    </mesh>
  )
}

function Floor({ dark }: { dark: boolean }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uColor: { value: new THREE.Color() }, uA: { value: 0.6 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 uColor; uniform float uA; varying vec2 vUv;
          void main(){ float d = length(vUv - 0.5) * 2.0; float a = (1.0 - smoothstep(0.15, 1.0, d)) * uA;
            float ring = smoothstep(0.012, 0.0, abs(d - 0.42)) * 0.35;
            gl_FragColor = vec4(uColor, a + ring * uA);
            #include <colorspace_fragment>
          }`,
      }),
    [],
  )
  mat.uniforms.uColor.value.set(dark ? WORLD.dark.floor : WORLD.light.floor)
  mat.uniforms.uA.value = dark ? 0.9 : 0.7
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.0005, 0]} material={mat}>
      <planeGeometry args={[2.4, 2.4]} />
    </mesh>
  )
}

/** Faint heart + spine visible only through the glass body. */
function Inner({ glass }: { glass: React.MutableRefObject<number> }) {
  const group = useRef<THREE.Group>(null!)
  const heart = useRef<THREE.Mesh>(null!)
  const spine = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 24; i++) {
      const t = i / 24
      const y = 0.95 + t * 0.6
      const z = -0.035 - 0.02 * Math.sin(t * Math.PI * 1.6)
      pts.push(new THREE.Vector3(0, y, z))
    }
    return pts
  }, [])
  const heartMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ff8b7a', emissive: '#ff5a4a', emissiveIntensity: 1.6, roughness: 0.4 }), [])
  const boneMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#dfeeff', emissive: '#8fc6ff', emissiveIntensity: 0.9, roughness: 0.5 }), [])
  useFrame(({ clock }) => {
    const g = glass.current
    group.current.visible = g > 0.05 && anatomyFx.reveal < 0.05
    const t = clock.elapsedTime
    // lub-dub, ~64 bpm
    const beat = Math.pow(Math.max(0, Math.sin(t * 6.8)), 12) + 0.6 * Math.pow(Math.max(0, Math.sin(t * 6.8 - 0.9)), 12)
    const s = g * (1 + beat * 0.16)
    heart.current.scale.set(s, s * 1.2, s * 0.9)
    heartMat.emissiveIntensity = (0.6 + beat * 2.4) * g
    boneMat.emissiveIntensity = 0.3 * g
  })
  return (
    <group ref={group}>
      <mesh ref={heart} position={[0.022, 1.3, 0.03]} rotation={[0.2, 0, -0.45]} material={heartMat}>
        <sphereGeometry args={[0.022, 24, 16]} />
      </mesh>
      {spine.map((p, i) => (
        <mesh key={i} position={p} material={boneMat} scale={[1.3, 0.6, 1]}>
          <sphereGeometry args={[0.007 + (1 - i / 24) * 0.0035, 10, 8]} />
        </mesh>
      ))}
    </group>
  )
}

function Pins() {
  const entries = useStore((s) => s.entries)
  const select = useStore((s) => s.select)
  const selected = useStore((s) => s.selected)
  // the low-poly surface sits a little proud of the sculpt, so lift pins clear of it
  const lift = useStore((s) => (s.bodyStyle === 'poly' ? 0.011 : 0.004))
  const pins = entries.filter((e) => e.point && e.regionId !== 'general')
  return (
    <>
      {pins.map((e) => (
        <Pin key={e.id} id={e.id} regionId={e.regionId} point={e.point!} normal={e.normal ?? [0, 0, 1]} intensity={e.intensity} lift={lift}
          dim={!!selected} onPick={() => select(e.regionId, { point: e.point!, normal: e.normal ?? [0, 0, 1] }, e.id)} />
      ))}
    </>
  )
}

function Pin({ point, normal, intensity, onPick, dim, lift }: { id: string; regionId: string; point: [number, number, number]; normal: [number, number, number]; intensity: number; onPick: () => void; dim: boolean; lift: number }) {
  const ring = useRef<THREE.Mesh>(null!)
  const dot = useRef<THREE.Mesh>(null!)
  const born = useRef(performance.now())
  const color = useMemo(() => new THREE.Color(intensityColor(intensity)), [intensity])
  const n = useMemo(() => new THREE.Vector3(...normal).normalize(), [normal])
  const pos = useMemo(() => new THREE.Vector3(...point).addScaledVector(n, lift), [point, n, lift])
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n), [n])
  useFrame(({ clock }) => {
    const age = (performance.now() - born.current) / 1000
    // springy pop-in: overshoot then settle
    const s = age > 1.2 ? 1 : 1 - Math.exp(-7 * age) * Math.cos(12 * age)
    dot.current.scale.setScalar(Math.max(0.001, s))
    const t = (clock.elapsedTime * 0.8) % 1
    ring.current.scale.setScalar(0.6 + t * 1.8)
    ;(ring.current.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.7 * (dim ? 0.4 : 1)
  })
  return (
    <group position={pos} quaternion={q}>
      <mesh ref={dot} onClick={(e) => { e.stopPropagation(); onPick() }}>
        <sphereGeometry args={[0.013, 20, 14]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.7} roughness={0.3} />
      </mesh>
      <mesh ref={ring}>
        <ringGeometry args={[0.016, 0.021, 40]} />
        <meshBasicMaterial color={color} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

function Body({ glassRef }: { glassRef: React.MutableRefObject<number> }) {
  const [detailed, setDetailed] = useState<THREE.BufferGeometry | null>(null)
  const [lowpoly, setLowpoly] = useState<THREE.BufferGeometry | null>(null)
  const { mat, uniforms } = useMemo(createBodyMaterial, [])
  const edgeMat = useMemo(() => new THREE.LineBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }), [])
  const edges = useMemo(() => (lowpoly ? new THREE.EdgesGeometry(lowpoly, 1) : null), [lowpoly])
  // which mesh is on screen, and a 0→1 swap transition (squash + flash, swap at the midpoint)
  const [shown, setShown] = useState<'detailed' | 'lowpoly'>(useStore.getState().bodyStyle === 'poly' ? 'lowpoly' : 'detailed')
  const swap = useRef(1)
  const polyC = useMemo(() => new THREE.Color(), [])
  const group = useRef<THREE.Group>(null!)
  const intro = useRef(0)
  const dark = useIsDark()
  const bodyStyle = useStore((s) => s.bodyStyle)
  const reduced = useStore((s) => s.reducedMotion)
  const set = useStore((s) => s.set)
  const select = useStore((s) => s.select)
  const clayC = useMemo(() => new THREE.Color(), [])
  const glassC = useMemo(() => new THREE.Color(), [])
  const tmpC = useMemo(() => new THREE.Color(), [])

  useEffect(() => {
    let alive = true
    const wantPoly = useStore.getState().bodyStyle === 'poly'
    const first = loadBodyGeometry(wantPoly ? 'lowpoly' : 'detailed')
    first.then((g) => {
      if (!alive) return
      if (wantPoly) setLowpoly(g); else setDetailed(g)
      set({ bodyReady: true })
      // warm the other look in the background so switching is instant
      loadBodyGeometry(wantPoly ? 'detailed' : 'lowpoly').then((o) => { if (alive) (wantPoly ? setDetailed : setLowpoly)(o) })
    })
    return () => { alive = false }
  }, [set])

  const target = bodyStyle === 'poly' ? 'lowpoly' : 'detailed'
  useEffect(() => { if (target !== shown) swap.current = 0 }, [target, shown])
  const geo = shown === 'lowpoly' ? lowpoly : detailed

  useFrame(({ clock }, dt) => {
    const s = useStore.getState()
    const w = dark ? WORLD.dark : WORLD.light
    // style morph
    const gGoal = bodyStyle === 'glass' ? 1 : 0
    glassRef.current = reduced ? gGoal : damp(glassRef.current, gGoal, 3.2, dt)
    const g = glassRef.current
    uniforms.uGlass.value = g
    // no transmission while the skin is cut open or see-through (last frame's state is fine here)
    const trans = g < 0.01 || anatomyFx.win.w > 0.001 || uniforms.uXray.value > 0.01 ? 0 : g
    if ((mat.transmission > 0) !== (trans > 0)) mat.needsUpdate = true
    mat.transmission = trans
    mat.roughness = THREE.MathUtils.lerp(0.62, 0.16, g)
    mat.sheen = THREE.MathUtils.lerp(0.6, 0, g)
    mat.clearcoat = THREE.MathUtils.lerp(0.08, 1, g)
    mat.clearcoatRoughness = THREE.MathUtils.lerp(0.6, 0.06, g)
    mat.iridescence = 0.5 * g
    mat.envMapIntensity = THREE.MathUtils.lerp(1, 1.6, g)
    clayC.set(w.clay); glassC.set(w.glass)
    mat.color.copy(tmpC.copy(clayC).lerp(glassC, g))
    uniforms.uRim.value.set(w.rim)
    uniforms.uRimAmt.value = THREE.MathUtils.lerp(dark ? 0.18 : 0.12, dark ? 0.9 : 0.55, g)
    uniforms.uAccent.value.set(w.accent)
    uniforms.uTime.value = clock.elapsedTime

    // clay/glass ⇄ poly: squash, flash, swap meshes at the midpoint
    let squash = 0
    if (swap.current < 1) {
      const ready = target === 'lowpoly' ? lowpoly : detailed
      if (ready) {
        swap.current = reduced ? 1 : Math.min(1, swap.current + dt / 0.55)
        if (swap.current >= 0.5 && shown !== target) setShown(target)
        squash = Math.sin(Math.PI * swap.current)
      }
    }
    const isPoly = shown === 'lowpoly'
    if (mat.flatShading !== isPoly) { mat.flatShading = isPoly; mat.needsUpdate = true }
    mat.polygonOffset = isPoly
    mat.polygonOffsetFactor = 1
    mat.polygonOffsetUnits = 1
    if (isPoly) {
      polyC.set(w.poly)
      mat.color.copy(polyC)
      mat.roughness = 0.78
      mat.sheen = 0
      mat.clearcoat = 0.12
      mat.clearcoatRoughness = 0.5
      mat.envMapIntensity = 0.45 // let the key light carve the facets
      uniforms.uRimAmt.value = dark ? 0.35 : 0.1
    }
    edgeMat.color.set(w.edge)
    edgeMat.opacity = w.edgeA * (1 - squash)
    uniforms.uRimAmt.value += squash * 0.9 // the flash

    // V0.2 anatomy: open a window in the skin at the tapped spot, or go see-through in X-ray
    const zoneHasAnatomy = !!(s.anatomyPreview && s.selected && s.selected !== 'general' && s.pendingPoint && structuresInZone(s.selected).length)
    const win = anatomyFx.win
    if (zoneHasAnatomy) {
      const [px, py, pz] = s.pendingPoint!.point, [nx, ny, nz] = s.pendingPoint!.normal
      win.x = px - nx * 0.012; win.y = py - ny * 0.012; win.z = pz - nz * 0.012
    }
    const winGoal = zoneHasAnatomy ? THREE.MathUtils.clamp(regionById(s.selected!).r * 1.2 + 0.03, 0.055, 0.15) : 0
    win.w = reduced ? winGoal : damp(win.w, winGoal, 6, dt)
    if (win.w < 0.002 && winGoal === 0) win.w = 0
    uniforms.uWin.value.copy(win)
    const xGoal = s.anatomyPreview && s.xray && anatomyFx.data ? 1 : 0
    uniforms.uXray.value = reduced ? xGoal : damp(uniforms.uXray.value, xGoal, 5, dt)
    const cutaway = win.w > 0.001 || uniforms.uXray.value > 0.01
    const side = cutaway ? THREE.DoubleSide : THREE.FrontSide
    if (mat.side !== side) { mat.side = side; mat.needsUpdate = true }
    const see = uniforms.uXray.value > 0.01
    mat.depthWrite = !see
    edgeMat.opacity *= 1 - uniforms.uXray.value

    // per-zone glow & tint
    const selIdx = s.selected && s.selected !== 'general' ? REGION_INDEX[s.selected] : -1
    const hovIdx = s.hovered ? REGION_INDEX[s.hovered] : -1
    const tintMax = new Array(REGIONS.length).fill(-1)
    for (const e of s.entries) {
      const i = REGION_INDEX[e.regionId]
      if (i !== undefined) tintMax[i] = Math.max(tintMax[i], e.intensity)
    }
    for (let i = 0; i < REGIONS.length; i++) {
      const goal = i === selIdx ? 1 : i === hovIdx ? 0.45 : 0
      uniforms.uGlow.value[i] = reduced ? goal : damp(uniforms.uGlow.value[i], goal, 9, dt)
      const tg = tintMax[i] >= 0 ? 1 : 0
      uniforms.uTintAmt.value[i] = damp(uniforms.uTintAmt.value[i], tg, 4, dt)
      if (tintMax[i] >= 0) {
        tmpC.set(intensityColor(tintMax[i]))
        uniforms.uTint.value[i].set(tmpC.r, tmpC.g, tmpC.b)
      }
    }
    uniforms.uFocusIdx.value = selIdx
    uniforms.uFocus.value = damp(uniforms.uFocus.value, selIdx >= 0 ? 1 : 0, 5, dt)

    // intro rise + idle breathing
    if (geo) intro.current = reduced ? 1 : Math.min(1, intro.current + dt / 1.6)
    const k = 1 - Math.pow(1 - intro.current, 4)
    const breathe = reduced ? 0 : Math.sin(clock.elapsedTime * 1.3) * 0.0035
    group.current.position.y = (1 - k) * -0.12
    group.current.scale.set(1 + breathe * 0.6 + squash * 0.02, 1 + breathe - squash * 0.035, 1 + breathe * 0.6 + squash * 0.02)
    mat.opacity = k
    mat.transparent = k < 1 || see
  })

  const down = useRef<{ x: number; y: number } | null>(null)
  const onDown = (e: ThreeEvent<PointerEvent>) => { down.current = { x: e.clientX, y: e.clientY } }
  /** Taps inside the skin window, or on visible anatomy in X-ray, belong to the anatomy. */
  const passThrough = (e: ThreeEvent<PointerEvent | MouseEvent>, local: THREE.Vector3) => {
    const w = anatomyFx.win
    if (w.w > 0.001 && local.distanceTo(new THREE.Vector3(w.x, w.y, w.z)) < w.w) return true
    return anatomyFx.reveal > 0.5 && useStore.getState().xray && e.intersections.some((i) => i.object.userData.anatomy)
  }
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    const d = down.current
    if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) { e.stopPropagation(); return }
    const local = group.current.worldToLocal(e.point.clone())
    if (passThrough(e, local)) return
    e.stopPropagation()
    const r = regionAt([local.x, local.y, local.z])
    const n = e.face?.normal ?? new THREE.Vector3(0, 0, 1)
    select(r.id, { point: [local.x, local.y, local.z], normal: [n.x, n.y, n.z] })
    if (navigator.vibrate) try { navigator.vibrate(8) } catch { /* noop */ }
  }
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (e.pointerType !== 'mouse') return
    const local = group.current.worldToLocal(e.point.clone())
    if (passThrough(e, local)) return
    e.stopPropagation()
    if (useStore.getState().hoverText) set({ hoverText: null })
    const id = regionAt([local.x, local.y, local.z]).id
    if (useStore.getState().hovered !== id) set({ hovered: id })
    document.body.style.cursor = 'pointer'
  }
  const onOut = () => { set({ hovered: null }); document.body.style.cursor = '' }

  return (
    <group ref={group}>
      {geo && (
        <mesh geometry={geo} material={mat} raycast={acceleratedRaycast} castShadow onPointerDown={onDown} onClick={onClick} onPointerMove={onMove} onPointerOut={onOut} />
      )}
      {edges && shown === 'lowpoly' && <lineSegments geometry={edges} material={edgeMat} raycast={() => null} />}
      <Inner glass={glassRef} />
      <Anatomy />
      <Pins />
    </group>
  )
}

function CameraRig() {
  const controls = useRef<OrbitControlsImpl>(null!)
  const { camera, size } = useThree()
  const cam = camera as THREE.PerspectiveCamera
  const selected = useStore((s) => s.selected)
  const facing = useStore((s) => s.facing)
  const view = useStore((s) => s.view)
  const onboarded = useStore((s) => s.onboarded)
  const reduced = useStore((s) => s.reducedMotion)
  const wide = useIsWide()
  const goal = useRef<{ target: THREE.Vector3; dist: number; az: number | null } | null>(null)
  const offset = useRef({ x: 0, y: 0 })
  const tmp = useMemo(() => new THREE.Spherical(), [])
  const v = useMemo(() => new THREE.Vector3(), [])

  const homeDist = useMemo(() => {
    const vFit = 1.02 / Math.tan(THREE.MathUtils.degToRad(FOV / 2))
    const aspect = size.width / Math.max(1, size.height)
    const hFit = 0.55 / (Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * aspect)
    return Math.max(vFit, hFit)
  }, [size.width, size.height])

  // New goal whenever selection / facing / view changes
  useEffect(() => {
    if (selected && selected !== 'general') {
      const r = regionById(selected)
      const c = regionCenter(r)
      const az = r.side === 'back' ? Math.PI : r.side === 'front' ? 0 : null
      goal.current = { target: new THREE.Vector3(...c), dist: r.zoom * (wide ? 2.4 : 2.3), az }
    } else {
      const far = view === 'summary' || view === 'history' || view === 'settings'
      goal.current = { target: HOME_TARGET.clone(), dist: homeDist * (!onboarded && !wide ? 1.55 : far && !wide ? 2.7 : 1), az: facing === 'back' ? Math.PI : 0 }
    }
  }, [selected, facing, homeDist, view, onboarded, wide])

  useEffect(() => {
    const c = controls.current
    if (!c) return
    const stop = () => { if (goal.current) goal.current.az = null }
    c.addEventListener('start', stop)
    return () => c.removeEventListener('start', stop)
  }, [])

  useFrame((_, dt) => {
    const c = controls.current
    if (!c) return
    const g = goal.current
    const L = reduced ? 60 : 3.6
    if (g) {
      c.target.x = damp(c.target.x, g.target.x, L, dt)
      c.target.y = damp(c.target.y, g.target.y, L, dt)
      c.target.z = damp(c.target.z, g.target.z, L, dt)
      v.copy(cam.position).sub(c.target)
      tmp.setFromVector3(v)
      tmp.radius = damp(tmp.radius, g.dist, L, dt)
      if (g.az !== null) tmp.theta = angleDamp(tmp.theta, g.az, L, dt)
      tmp.phi = damp(tmp.phi, Math.PI / 2 - 0.06, L * 0.5, dt)
      v.setFromSpherical(tmp)
      cam.position.copy(c.target).add(v)
      if (Math.abs(tmp.radius - g.dist) < 0.002 && c.target.distanceTo(g.target) < 0.002 &&
          (g.az === null || Math.abs(Math.atan2(Math.sin(tmp.theta - g.az), Math.cos(tmp.theta - g.az))) < 0.002)) {
        goal.current = null
      }
    }
    // idle turntable on the welcome screen
    c.autoRotate = !onboarded && !reduced
    c.autoRotateSpeed = 0.8

    // shift the framing so the body stays visible beside/above the open panel
    const sheetOpen = !!selected || view === 'summary' || view === 'history' || view === 'settings'
    const gx = sheetOpen && wide ? size.width * 0.2 : !onboarded && wide ? -size.width * 0.16 : 0
    const gy = sheetOpen && !wide ? size.height * (selected ? 0.26 : 0.34) : !onboarded && !wide ? size.height * 0.2 : 0
    offset.current.x = damp(offset.current.x, gx, L, dt)
    offset.current.y = damp(offset.current.y, gy, L, dt)
    cam.setViewOffset(size.width, size.height, offset.current.x, offset.current.y, size.width, size.height)
    c.update()
  })

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.7}
      minDistance={0.9}
      maxDistance={homeDist * 2}
      minPolarAngle={Math.PI * 0.3}
      maxPolarAngle={Math.PI * 0.58}
      target={HOME_TARGET}
    />
  )
}

export default function Scene() {
  const dark = useIsDark()
  const glassRef = useRef(useStore.getState().bodyStyle === 'glass' ? 1 : 0)
  const w = dark ? WORLD.dark : WORLD.light
  const ready = useStore((s) => s.bodyReady)
  return (
    <Canvas
      className="scene"
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: FOV, position: [0, 1.0, 4.2], near: 0.05, far: 60 }}
      onPointerMissed={() => useStore.getState().set({ hovered: null })}
    >
      <Backdrop dark={dark} />
      <hemisphereLight args={[dark ? '#b8c7de' : '#fff8ef', dark ? '#1b1f26' : '#c9b8a6', dark ? 0.5 : 0.55]} />
      <directionalLight position={[-2.2, 3.4, 2.6]} intensity={dark ? 1.6 : 2.4} color={dark ? '#e6eeff' : '#fff0de'} />
      <directionalLight position={[2.6, 1.8, -2.4]} intensity={dark ? 1.6 : 0.9} color={dark ? '#7fb8ff' : '#dfe9ff'} />
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2.2} position={[-3, 3, 3]} scale={[4, 3, 1]} color="#fff4ea" />
        <Lightformer form="rect" intensity={1.4} position={[3, 1.5, 2]} scale={[2, 4, 1]} color="#e9f1ff" />
        <Lightformer form="rect" intensity={2.4} position={[0, 2, -4]} scale={[6, 2, 1]} color={dark ? '#6aa8ff' : '#ffffff'} />
        <Lightformer form="ring" intensity={1.2} position={[0, 5, 0]} scale={3} color="#ffffff" />
      </Environment>
      <Floor dark={dark} />
      <ContactShadows key={`${ready}-${dark}`} position={[0, 0.001, 0]} scale={1.6} blur={2.6} far={1.2} opacity={dark ? 0.7 : 0.38} color={w.shadow} frames={1} resolution={512} />
      <Body glassRef={glassRef} />
      <CameraRig />
    </Canvas>
  )
}
