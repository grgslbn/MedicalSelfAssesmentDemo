/**
 * Build Soma's lean "X-ray" anatomy package from the BodyParts3D data shipped with
 * https://github.com/ashemag/human-atlas (BodyParts3D 4.0, © DBCLS, CC BY 4.0).
 *
 *   node --experimental-strip-types scripts/extract-anatomy.mts <path-to-human-atlas>/public/models
 *
 * Steps: pick a curated subset (bones, major organs, major superficial muscles) →
 * warp it into Soma's slimmer, gender-neutral body → build smooth envelopes for organs the
 * dataset lacks (lungs, liver) → simplify with meshoptimizer → quantize → write
 * public/anatomy/{bones,organs,muscles}.bin + anatomy.json.
 */
import fs from 'node:fs'
import path from 'node:path'
import { MeshoptSimplifier } from 'meshoptimizer'
import { makeSphere, type Prim, type Vec3 } from '../src/body/sdf.ts'
import { meshPatch } from '../src/body/mesher.ts'
import { regionAt } from '../src/data/regions.ts'

const SRC = process.argv[2] ?? '../ashemag/human-atlas/public/models'
const OUT = path.resolve(import.meta.dirname, '../public/anatomy')

type Layer = 'bones' | 'organs' | 'muscles'
interface Atlas { parts: Part[] }
interface Part { name: string; system: string; chunk: number; positions: number; normals: number; indices: number; vertexCount: number; indexCount: number; bounds: [number[], number[]] }
interface Mesh { pos: Float32Array; nor: Float32Array; idx: Uint32Array }

const atlas: Atlas = JSON.parse(fs.readFileSync(path.join(SRC, 'atlas.json'), 'utf8'))
const chunks = new Map<number, Buffer>()
function readPart(p: Part): Mesh {
  if (!chunks.has(p.chunk)) chunks.set(p.chunk, fs.readFileSync(path.join(SRC, `body-${p.chunk}.bin`)))
  const b = chunks.get(p.chunk)!
  const ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)
  const pos = new Float32Array(ab, p.positions, p.vertexCount * 3).slice()
  const n16 = new Int16Array(ab, p.normals, p.vertexCount * 3)
  const nor = Float32Array.from(n16, (v) => v / 32767)
  const idx = new Uint32Array(ab, p.indices, p.indexCount).slice()
  return { pos, nor, idx }
}

// ── 1. Selection & labels ─────────────────────────────────────────────────
const side = (n: string) => n.replace(/\b(left|right)\s+/gi, '').replace(/^(left|right)\s+/i, '')
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const MUSCLES: [RegExp, string][] = [
  [/deltoid/i, 'Shoulder muscle (deltoid)'], [/pectoralis major/i, 'Chest muscle (pectoralis major)'],
  [/external oblique/i, 'Side abdominal muscle (oblique)'], [/trapezius/i, 'Upper back muscle (trapezius)'],
  [/gluteus (maximus|medius)/i, 'Buttock muscle (gluteus)'], [/biceps brachii|brachialis\b/i, 'Biceps'],
  [/triceps/i, 'Triceps'], [/brachioradialis/i, 'Forearm muscle (brachioradialis)'],
  [/rectus femoris|vastus (lateralis|medialis)/i, 'Front thigh muscles (quadriceps)'], [/sartorius/i, 'Sartorius (thigh)'],
  [/biceps femoris|semitendinosus|semimembranosus/i, 'Back thigh muscles (hamstrings)'],
  [/gastrocnemius|soleus/i, 'Calf muscles'], [/tibialis anterior/i, 'Shin muscle (tibialis anterior)'],
  [/fibularis longus/i, 'Outer shin muscle (fibularis)'],
  [/sternocleidomastoid/i, 'Neck muscle (sternocleidomastoid)'], [/serratus anterior/i, 'Rib-side muscle (serratus anterior)'],
  [/adductor longus|gracilis/i, 'Inner thigh muscles (adductors)'], [/infraspinatus|teres major/i, 'Shoulder-blade muscles'],
]

const BONES: [RegExp, string][] = [
  [/patella/i, 'Kneecap (patella)'], [/femur/i, 'Thigh bone (femur)'], [/tibia\b/i, 'Shin bone (tibia)'], [/fibula\b/i, 'Calf bone (fibula)'],
  [/humerus/i, 'Upper arm bone (humerus)'], [/radius/i, 'Forearm bone (radius)'], [/ulna\b/i, 'Forearm bone (ulna)'],
  [/clavicle/i, 'Collarbone (clavicle)'], [/scapula/i, 'Shoulder blade (scapula)'],
  [/sternum|manubrium|xiphoid/i, 'Breastbone (sternum)'], [/costal cartilage/i, 'Rib cartilage'], [/\brib\b/i, 'Ribs'],
  [/cervical vertebra|^atlas$|^axis$|disk of (axis|\w+ cervical)/i, 'Neck vertebrae (cervical spine)'],
  [/thoracic vertebra/i, 'Upper back vertebrae (thoracic spine)'], [/lumbar vertebra/i, 'Lower back vertebrae (lumbar spine)'],
  [/intervertebral disk/i, 'Spinal discs'], [/sacrum/i, 'Sacrum'], [/coccy/i, 'Tailbone (coccyx)'], [/hip bone/i, 'Hip bone (pelvis)'],
  [/mandible/i, 'Jaw bone (mandible)'], [/frontal|parietal|temporal bone|occipital|sphenoid|ethmoid|nasal bone|maxilla|zygomatic|palatine|vomer|lacrimal/i, 'Skull'],
  [/hyoid|thyroid cartilage|cricoid/i, 'Voice box & hyoid'],
  [/scaphoid|lunate|triquetral|pisiform|trapezium|trapezoid|capitate|hamate/i, 'Wrist bones (carpals)'],
  [/metacarpal/i, 'Hand bones (metacarpals)'], [/phalanx of .*(finger|thumb)/i, 'Finger bones'],
  [/talus/i, 'Ankle bone (talus)'], [/calcaneus/i, 'Heel bone (calcaneus)'],
  [/navicular|cuboid|cuneiform bone/i, 'Midfoot bones'], [/metatarsal/i, 'Foot bones (metatarsals)'], [/phalanx of .*toe|sesamoid bone of/i, 'Toe bones'],
]

const ORGANS: [RegExp, string, string][] = [
  // [pattern, label, colour]
  [/^wall of (ventricle|left atrium|right atrium)$/i, 'Heart', '#d27a6c'],
  [/^trachea$|bronchial tree|main bronchus/i, 'Airways (trachea & bronchi)', '#e2b2ae'],
  [/^stomach$/i, 'Stomach', '#d9a98a'], [/^esophagus$/i, 'Oesophagus (food pipe)', '#d9a98a'], [/^duodenum$/i, 'Duodenum', '#d9b48f'],
  [/part of (ileum|jejunum)|ileocecal/i, 'Small intestine', '#dcb996'], [/colon|^cecum$/i, 'Large intestine (colon)', '#c9a27d'],
  [/^rectum$/i, 'Rectum', '#c9a27d'], [/^appendix$/i, 'Appendix', '#c9a27d'], [/^pancreas$/i, 'Pancreas', '#e2c38f'],
  [/^gallbladder$/i, 'Gallbladder', '#a8b77c'], [/kidney/i, 'Kidney', '#c98a73'], [/ureter/i, 'Ureter', '#c98a73'],
  [/urinary bladder/i, 'Bladder', '#d8b07a'], [/^spleen$/i, 'Spleen', '#b97a7a'], [/adrenal gland/i, 'Adrenal gland', '#d8b07a'],
  [/white matter of .* cerebral hemisphere|^cerebellum$|^pons$|^midbrain$|medulla oblongata|superior parietal lobule|occipital lobe/i, 'Brain', '#e7d3b4'],
]
const LAYER_COLOR: Record<Layer, string> = { bones: '#efe5d1', muscles: '#c99486', organs: '#d9a98a' }

interface Pick { layer: Layer; label: string; color: string; arm: boolean; hand: 0 | 1 | -1 }
const ARM = /humerus|radius|ulna|carpal|metacarpal|phalanx of .*(finger|thumb)|scaphoid|lunate|triquetral|pisiform|trapezium|trapezoid|capitate|hamate|deltoid|biceps brachii|triceps|brachi/i
const HAND = /carpal|metacarpal|phalanx of .*(finger|thumb)|scaphoid|lunate|triquetral|pisiform|trapezium|trapezoid|capitate|hamate/i

function classify(p: Part): Pick | null {
  const n = p.name
  if (/tooth|gingiva|incisor|molar|canine|alar cartilage|arytenoid|corniculate|cuneiform cartilage/i.test(n)) return null
  const sideOf = /left/i.test(n) ? 1 : /right/i.test(n) ? -1 : 0
  const arm = ARM.test(n)
  const hand = HAND.test(n) ? (sideOf as 1 | -1) : 0
  for (const [re, label] of MUSCLES) if (re.test(n)) return { layer: 'muscles', label, color: LAYER_COLOR.muscles, arm, hand }
  if (p.system === 'skeletal' || p.system === 'connective') {
    if (p.system === 'connective' && !/intervertebral|costal cartilage/i.test(n)) return null
    for (const [re, label] of BONES) if (re.test(n)) return { layer: 'bones', label, color: LAYER_COLOR.bones, arm, hand }
    return p.system === 'skeletal' && !/tract|muscle|scapulae|subscapularis|tibialis|fibularis/i.test(n)
      ? { layer: 'bones', label: cap(side(n)), color: LAYER_COLOR.bones, arm, hand } : null
  }
  for (const [re, label, color] of ORGANS) if (re.test(n)) return { layer: 'organs', label, color, arm: false, hand: 0 }
  return null
}

// ── 2. Warp BodyParts3D (adult male) into Soma's figure ───────────────────
// Heights: atlas landmark → Soma landmark (feet, knee, hip, shoulder, crown).
const Y_MAP: [number, number][] = [[0, 0], [0.46, 0.497], [0.93, 0.965], [1.415, 1.43], [1.719, 1.745]]
// Per-height fit measured from cross-sections of the atlas skin vs Soma's SDF:
// [atlas y, x scale, z scale, atlas z-centre, Soma z-centre]
const FIT: [number, number, number, number, number][] = [
  [0.0, 1.06, 0.98, -0.0095, 0.011], [0.3, 1.045, 0.76, -0.0465, -0.012], [0.46, 1.12, 0.86, -0.0275, 0.001],
  [0.5, 1.15, 0.87, -0.0135, 0.005], [0.7, 0.95, 0.76, -0.0115, 0.005], [0.85, 0.975, 0.76, -0.0195, -0.006],
  [0.95, 1.03, 0.9, -0.019, -0.011], [1.05, 0.79, 0.8, 0.005, 0.001], [1.15, 0.8, 0.72, 0.0045, 0.005],
  [1.25, 0.82, 0.72, -0.005, -0.001], [1.33, 0.97, 0.8, -0.0175, -0.003], [1.4, 1.0, 0.88, -0.0335, -0.005],
  [1.47, 1.05, 0.98, -0.0345, -0.004], [1.55, 0.95, 0.8, 0.0015, 0.015], [1.63, 1.02, 0.93, -0.0205, 0.004],
  [1.72, 1.04, 1.0, -0.0225, -0.005],
]
function lerpTable<T extends number[]>(t: T[], y: number): number[] {
  if (y <= t[0][0]) return t[0].slice(1)
  for (let i = 1; i < t.length; i++) if (y <= t[i][0]) {
    const a = t[i - 1], b = t[i], k = (y - a[0]) / (b[0] - a[0])
    return a.slice(1).map((v, j) => v + (b[j + 1] - v) * k)
  }
  return t[t.length - 1].slice(1)
}
const mapY = (y: number) => lerpTable(Y_MAP, y)[0]

function warp(m: Mesh, pick: Pick): Mesh {
  const pos = m.pos.slice(), nor = m.nor.slice()
  for (let i = 0; i < pos.length; i += 3) {
    let x = pos[i], y = pos[i + 1], z = pos[i + 2]
    let nx = nor[i], nz = nor[i + 2]
    if (pick.hand) {
      // atlas hands face forward and are smaller than Soma's sculpted hands:
      // scale about the wrist, then turn 90° so the palms face the thighs
      const px = 0.262 * pick.hand, py = 0.892, pz = -0.005, a = (-Math.PI / 2) * pick.hand, k = 1.22
      x = px + (x - px) * k; y = py + (y - py) * k; z = pz + (z - pz) * k
      const c = Math.cos(a), s = Math.sin(a)
      const dx = x - px, dz = z - pz
      x = px + dx * c + dz * s; z = pz - dx * s + dz * c
      const tnx = nx * c + nz * s; nz = -nx * s + nz * c; nx = tnx
    }
    if (pick.arm) {
      // Soma's arms hang ~3° wider than the atlas: swing them out about the shoulder
      const drop = Math.max(0, 1.4 - y)
      pos[i] = x + Math.sign(x) * (0.005 + drop * 0.055); pos[i + 1] = mapY(y); pos[i + 2] = z + 0.01
      nor[i] = nx; nor[i + 2] = nz
    } else {
      const [sx, sz, zt, zo] = lerpTable(FIT, y)
      pos[i] = x * sx; pos[i + 1] = mapY(y); pos[i + 2] = (z - zt) * sz + zo
      // normals transform with the inverse scale
      const ny = nor[i + 1]
      const wx = nx / sx, wz = nz / sz
      const l = Math.hypot(wx, ny, wz) || 1
      nor[i] = wx / l; nor[i + 1] = ny / l; nor[i + 2] = wz / l
    }
  }
  return { pos, nor, idx: m.idx }
}

// ── 3. Simplify & merge helpers ───────────────────────────────────────────
await MeshoptSimplifier.ready
function simplify(m: Mesh, ratio: number, minTris = 40): Mesh {
  const tris = m.idx.length / 3
  const target = Math.max(minTris, Math.floor(tris * ratio)) * 3
  if (target >= m.idx.length) return m
  const [idx] = MeshoptSimplifier.simplify(m.idx, m.pos, 3, target, 0.02)
  return compact({ ...m, idx })
}
function compact(m: Mesh): Mesh {
  const remap = new Int32Array(m.pos.length / 3).fill(-1)
  let n = 0
  for (const i of m.idx) if (remap[i] < 0) remap[i] = n++
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3)
  for (let i = 0; i < remap.length; i++) if (remap[i] >= 0) {
    pos.set(m.pos.subarray(i * 3, i * 3 + 3), remap[i] * 3); nor.set(m.nor.subarray(i * 3, i * 3 + 3), remap[i] * 3)
  }
  return { pos, nor, idx: Uint32Array.from(m.idx, (i) => remap[i]) }
}
function merge(ms: Mesh[]): Mesh {
  const nv = ms.reduce((s, m) => s + m.pos.length, 0), ni = ms.reduce((s, m) => s + m.idx.length, 0)
  const pos = new Float32Array(nv), nor = new Float32Array(nv), idx = new Uint32Array(ni)
  let vo = 0, io = 0
  for (const m of ms) {
    pos.set(m.pos, vo); nor.set(m.nor, vo)
    for (let i = 0; i < m.idx.length; i++) idx[io + i] = m.idx[i] + vo / 3
    vo += m.pos.length; io += m.idx.length
  }
  return { pos, nor, idx }
}
function centroid(m: Mesh): Vec3 {
  let x = 0, y = 0, z = 0
  const n = m.pos.length / 3
  for (let i = 0; i < m.pos.length; i += 3) { x += m.pos[i]; y += m.pos[i + 1]; z += m.pos[i + 2] }
  return [x / n, y / n, z / n]
}

// ── 4. Envelopes for organs the dataset lacks (lungs, liver) ──────────────
function envelope(meshes: Mesh[], radius: number, stride: number): Mesh {
  const src: Prim[] = []
  let min: Vec3 = [1, 3, 1], max: Vec3 = [-1, -1, -1]
  for (const m of meshes) for (let i = 0; i < m.pos.length; i += 3 * stride) {
    const c: Vec3 = [m.pos[i], m.pos[i + 1], m.pos[i + 2]]
    src.push(makeSphere(c, radius, radius * 1.4))
    for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], c[k] - radius * 2); max[k] = Math.max(max[k], c[k] + radius * 2) }
  }
  const d = meshPatch({ min, max, h: 0.005, source: src })
  return { pos: d.positions, nor: d.normals, idx: d.indices }
}

// ── 5. Build ───────────────────────────────────────────────────────────────
interface Struct { id: number; label: string; layer: Layer; zones: string[]; side: 'L' | 'R' | 'C'; color: string; approx?: boolean; parts: number }
const groups = new Map<string, { layer: Layer; label: string; color: string; zone: string; meshes: Mesh[]; approx?: boolean }>()

/** Every zone that holds a real share of the structure's surface (long bones span several). */
function zonesOf(m: Mesh): string[] {
  const count = new Map<string, number>()
  const n = m.pos.length / 3
  for (let i = 0; i < m.pos.length; i += 3) {
    const id = regionAt([m.pos[i], m.pos[i + 1], m.pos[i + 2]]).id
    count.set(id, (count.get(id) ?? 0) + 1)
  }
  const sorted = [...count].sort((a, b) => b[1] - a[1])
  return sorted.filter(([, c], i) => i === 0 || c / n >= 0.08).map(([z]) => z)
}
const RATIO: Record<Layer, number> = { bones: 0.16, muscles: 0.12, organs: 0.3 }
const lungSrc: { L: Mesh[]; R: Mesh[] } = { L: [], R: [] }
const liverSrc: Mesh[] = []

let kept = 0
for (const p of atlas.parts) {
  const n = p.name
  const pick = classify(p)
  const isLung = /bronchial tree|main bronchus/i.test(n)
  const isLiver = /hepatovenous|hepatic vein|hepatic biliary tree|hepatic duct|caudate lobe|portal vein|hepatic artery/i.test(n)
  if (!pick && !isLiver) continue
  const raw = readPart(p)
  const w = warp(raw, pick ?? { layer: 'organs', label: '', color: '', arm: false, hand: 0 })
  if (isLung) (centroid(w)[0] >= 0 ? lungSrc.L : lungSrc.R).push(w)
  if (isLiver) { liverSrc.push(w); if (!pick) continue }
  if (!pick) continue
  const s = simplify(w, RATIO[pick.layer])
  // group left/right copies separately; everything else by label
  const lr = /\bleft\b/i.test(n) ? 'L' : /\bright\b/i.test(n) ? 'R' : centroid(s)[0] > 0.02 ? 'L' : centroid(s)[0] < -0.02 ? 'R' : 'C'
  const zone = lr
  const key = `${pick.layer}|${pick.label}|${lr}`
  if (!groups.has(key)) groups.set(key, { layer: pick.layer, label: pick.label, color: pick.color, zone, meshes: [] })
  groups.get(key)!.meshes.push(s)
  kept++
}
for (const [label, list] of [['Left lung (approximate)', lungSrc.L], ['Right lung (approximate)', lungSrc.R]] as const) {
  const env = simplify(envelope(list, 0.017, 3), 0.25)
  groups.set(`organs|${label}`, { layer: 'organs', label, color: '#efd3d0', zone: '', meshes: [env], approx: true })
}
{
  const env = simplify(envelope(liverSrc, 0.018, 4), 0.25)
  groups.set('organs|Liver', { layer: 'organs', label: 'Liver (approximate)', color: '#c99a86', zone: '', meshes: [env], approx: true })
}

// ── 6. Pack per layer: Int16 positions (quantized), Int8 normals, Uint16 structure ids, Uint32 indices
fs.mkdirSync(OUT, { recursive: true })
const structs: Struct[] = []
const manifest: { version: string; source: string; license: string; layers: Record<string, unknown>; structures: Struct[] } = {
  version: '0.2.0', source: 'BodyParts3D 4.0 via ashemag/human-atlas', license: 'CC BY 4.0 (anatomy data), © The Database Center for Life Science',
  layers: {}, structures: structs,
}
let totalBytes = 0, totalTris = 0
for (const layer of ['bones', 'organs', 'muscles'] as Layer[]) {
  const list = [...groups.values()].filter((g) => g.layer === layer).sort((a, b) => a.label.localeCompare(b.label))
  const meshes: Mesh[] = [], sids: number[] = []
  for (const g of list) {
    const id = structs.length
    const m = merge(g.meshes)
    const c = centroid(m)
    const side = g.zone === 'L' || g.zone === 'R' ? g.zone : c[0] > 0.03 ? 'L' : c[0] < -0.03 ? 'R' : 'C'
    structs.push({ id, label: g.label, layer, zones: zonesOf(m), side, color: g.color, approx: g.approx, parts: g.meshes.length })
    meshes.push(m)
    sids.push(...new Array(m.pos.length / 3).fill(id))
  }
  const m = merge(meshes)
  const nv = m.pos.length / 3, ni = m.idx.length
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < m.pos.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], m.pos[i + k]); max[k] = Math.max(max[k], m.pos[i + k]) }
  const q = new Int16Array(nv * 3)
  for (let i = 0; i < m.pos.length; i++) {
    const k = i % 3
    q[i] = Math.round(((m.pos[i] - min[k]) / (max[k] - min[k] || 1)) * 65535 - 32768)
  }
  const n8 = Int8Array.from(m.nor, (v) => Math.round(Math.max(-1, Math.min(1, v)) * 127))
  const sid = Uint16Array.from(sids)
  const align = (n: number) => (n + 3) & ~3
  const oPos = 0, oNor = align(q.byteLength), oSid = align(oNor + n8.byteLength), oIdx = align(oSid + sid.byteLength)
  const buf = Buffer.alloc(oIdx + ni * 4)
  Buffer.from(q.buffer).copy(buf, oPos); Buffer.from(n8.buffer).copy(buf, oNor); Buffer.from(sid.buffer).copy(buf, oSid)
  Buffer.from(m.idx.buffer).copy(buf, oIdx)
  fs.writeFileSync(path.join(OUT, `${layer}.bin`), buf)
  manifest.layers[layer] = { file: `${layer}.bin`, bytes: buf.length, vertexCount: nv, indexCount: ni, min, max, offsets: { position: oPos, normal: oNor, sid: oSid, index: oIdx } }
  totalBytes += buf.length; totalTris += ni / 3
  console.log(`${layer.padEnd(8)} ${list.length} structures · ${(ni / 3) | 0} tris · ${(buf.length / 1e6).toFixed(2)} MB`)
}
fs.writeFileSync(path.join(OUT, 'anatomy.json'), JSON.stringify(manifest))
console.log(`kept ${kept} source meshes → ${structs.length} structures · ${totalTris | 0} tris · ${(totalBytes / 1e6).toFixed(2)} MB`)
