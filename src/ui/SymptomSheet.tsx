import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { regionById } from '../data/regions'
import { ONSETS, PATTERNS, QUALITIES, redFlagsFor, symptomsFor } from '../data/symptoms'
import { useStore, type Entry } from '../state/store'
import { intensityColor } from './colors'
import { Icon } from './icons'
import { IntensityPicker } from './IntensityPicker'
import { Chips, IconButton, Sheet, ease, spring } from './kit'
import { pickList } from '../anatomy/Anatomy'
import { LAYERS } from '../anatomy/data'

type StepKey = 'where' | 'what' | 'how' | 'when' | 'else'
const STEP_LABEL: Record<StepKey, string> = { where: 'Where', what: 'What', how: 'How much', when: 'Since when', else: 'Anything else' }
const LAYER_TITLE = { bones: 'Bones', organs: 'Organs', muscles: 'Muscles' } as const

type Draft = Omit<Entry, 'id' | 'createdAt' | 'regionId' | 'point' | 'normal'>

const EMPTY: Draft = { symptoms: [], intensity: 3, qualities: [], onset: '', patterns: [], flags: [], notes: '' }

export function SymptomSheet() {
  // keep rendering the last zone while the sheet animates out
  const live = useStore((s) => s.selected)
  const last = useRef(live)
  if (live) last.current = live
  const selected = last.current ?? 'general'
  const editingId = useStore((s) => s.editingId)
  const entries = useStore((s) => s.entries)
  const pending = useStore((s) => s.pendingPoint)
  const profile = useStore((s) => s.profile)
  const select = useStore((s) => s.select)
  const saveEntry = useStore((s) => s.saveEntry)
  const removeEntry = useStore((s) => s.removeEntry)

  const existing = editingId ? entries.find((e) => e.id === editingId) : undefined
  const [draft, setDraft] = useState<Draft>(existing ?? EMPTY)
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)

  // reset when the user taps a different zone
  useEffect(() => {
    setDraft(existing ?? EMPTY)
    setStep(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, editingId])

  const general = selected === 'general'
  const region = general ? null : regionById(selected)
  const group = general ? 'general' : region!.group
  const title = general ? 'Whole body' : region!.label
  const symptoms = useMemo(() => symptomsFor(group, profile.sex), [group, profile.sex])
  const flags = useMemo(() => redFlagsFor(group), [group])
  const others = entries.filter((e) => e.regionId === selected && e.id !== editingId)

  // V0.2: pinpoint the exact structure when the anatomy preview is on
  const anatomyReady = useStore((s) => s.anatomyPreview && s.anatomyProgress >= 1)
  const focusStructure = useStore((s) => s.focusStructure)
  const layers = useStore((s) => s.anatomyLayers)
  const setStore = useStore((s) => s.set)
  const tapX = pending?.point[0] ?? existing?.point?.[0]
  const zoneStructures = useMemo(() => (anatomyReady && !general ? pickList(selected, tapX) : []), [anatomyReady, general, selected, tapX])
  const withWhere = zoneStructures.length > 0
  const steps: StepKey[] = withWhere ? ['where', 'what', 'how', 'when', 'else'] : ['what', 'how', 'when', 'else']
  const key = steps[Math.min(step, steps.length - 1)]
  const isLast = step >= steps.length - 1
  const whatIndex = steps.indexOf('what')
  // a structure tapped in 3D becomes the answer to "Where exactly?"
  useEffect(() => {
    const st = zoneStructures.find((z) => z.id === focusStructure)
    if (st) setDraft((d) => (d.structure?.id === st.id ? d : { ...d, structure: { id: st.id, label: st.label } }))
  }, [focusStructure, zoneStructures])
  const pickStructure = (id: number | null) => {
    const st = zoneStructures.find((z) => z.id === id)
    setDraft((d) => ({ ...d, structure: st ? { id: st.id, label: st.label } : undefined }))
    setStore({ focusStructure: st ? st.id : null })
  }

  const up = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }))
  const body = useRef<HTMLDivElement>(null)
  const go = (n: number) => { setDir(n > step ? 1 : -1); setStep(n); body.current?.scrollTo({ top: 0 }) }
  const canSave = draft.symptoms.length > 0
  const close = () => select(null)
  const save = () => {
    saveEntry({ ...draft, regionId: selected, point: pending?.point ?? existing?.point, normal: pending?.normal ?? existing?.normal })
  }

  return (
    <Sheet label={`Describe symptoms: ${title}`} onClose={close}>
      <header className="sheet-head">
        <div>
          <motion.div className="eyebrow" key={`e-${selected}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {editingId ? 'Editing' : general ? 'General symptoms' : 'You tapped'}
          </motion.div>
          <motion.h2 key={selected} initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 0.5, ease }}>
            {title}
          </motion.h2>
        </div>
        <IconButton label="Close" onClick={close}><Icon.close /></IconButton>
      </header>

      {others.length > 0 && step <= whatIndex && (
        <div className="already">
          Already logged here:{' '}
          {others.map((o) => (
            <button key={o.id} className="mini-pill" style={{ ['--ic' as string]: intensityColor(o.intensity) }} onClick={() => select(o.regionId, { point: o.point!, normal: o.normal! }, o.id)}>
              {o.intensity}/10 · edit
            </button>
          ))}
        </div>
      )}

      <nav className="stepper" aria-label="Steps" style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}>
        {steps.map((s, i) => (
          <button key={s} className={`step ${i === step ? 'on' : ''} ${i < step ? 'done' : ''}`} onClick={() => (i <= whatIndex || canSave) && go(i)} aria-current={i === step}>
            <span className="bar"><motion.span initial={false} animate={{ scaleX: i <= step ? 1 : 0 }} transition={spring} /></span>
            <span className="lbl">{STEP_LABEL[s]}</span>
          </button>
        ))}
      </nav>

      <div className="sheet-body" ref={body}>
        <AnimatePresence mode="popLayout" custom={dir} initial={false}>
          <motion.div
            key={step}
            custom={dir}
            className="step-pane"
            variants={{
              enter: (d: number) => ({ x: d * 40, opacity: 0, filter: 'blur(4px)' }),
              center: { x: 0, opacity: 1, filter: 'blur(0px)' },
              exit: (d: number) => ({ x: d * -40, opacity: 0, filter: 'blur(4px)' }),
            }}
            initial="enter" animate="center" exit="exit"
            transition={{ duration: 0.42, ease }}
          >
            {key === 'where' && (
              <>
                <h3>Where exactly?</h3>
                <p className="hint">Tap a structure inside the window, or pick one below. Not sure? Just continue.</p>
                <div className="structure-list">
                  {LAYERS.map((l) => {
                    const list = zoneStructures.filter((z) => z.layer === l)
                    if (!list.length) return null
                    return (
                      <div key={l} className="structure-group">
                        <small>{LAYER_TITLE[l]}</small>
                        <Chips multi={false} options={list.map((z) => ({ id: String(z.id), label: z.label }))}
                          value={draft.structure ? [String(draft.structure.id)] : []}
                          onChange={(v) => { pickStructure(v[0] ? Number(v[0]) : null); if (v[0] && !layers[l]) setStore({ anatomyLayers: { ...layers, [l]: true } }) }} />
                      </div>
                    )
                  })}
                </div>
                <h4>Show layers</h4>
                <Chips options={LAYERS.map((l) => ({ id: l, label: LAYER_TITLE[l] }))} value={LAYERS.filter((l) => layers[l])}
                  onChange={(v) => setStore({ anatomyLayers: { bones: v.includes('bones'), organs: v.includes('organs'), muscles: v.includes('muscles') } })} />
              </>
            )}
            {key === 'what' && (
              <>
                <h3>What do you feel?</h3>
                <p className="hint">Pick everything that fits.</p>
                <Chips options={symptoms} value={draft.symptoms} onChange={(v) => up({ symptoms: v })} />
              </>
            )}
            {key === 'how' && (
              <>
                <h3>How strong is it right now?</h3>
                <IntensityPicker value={draft.intensity} onChange={(v) => up({ intensity: v })} />
                <h4>What is it like? <span className="opt">optional</span></h4>
                <Chips options={QUALITIES} value={draft.qualities} onChange={(v) => up({ qualities: v })} />
              </>
            )}
            {key === 'when' && (
              <>
                <h3>Since when?</h3>
                <Chips options={ONSETS} value={draft.onset ? [draft.onset] : []} multi={false} onChange={(v) => up({ onset: v[0] ?? '' })} />
                <h4>How does it behave? <span className="opt">optional</span></h4>
                <Chips options={PATTERNS} value={draft.patterns} onChange={(v) => up({ patterns: v })} />
              </>
            )}
            {key === 'else' && (
              <>
                {flags.length > 0 && (
                  <>
                    <h3>Do any of these apply?</h3>
                    <p className="hint">These help us spot anything that needs attention quickly.</p>
                    <Chips options={flags} value={draft.flags} onChange={(v) => up({ flags: v })} tone="alert" />
                  </>
                )}
                <h4>Anything else to note? <span className="opt">optional</span></h4>
                <textarea
                  className="notes" rows={3} value={draft.notes} placeholder="e.g. started after running, better with ibuprofen…"
                  onChange={(e) => up({ notes: e.target.value })}
                />
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <footer className="sheet-foot">
        {step > 0 ? (
          <button className="btn ghost" onClick={() => go(step - 1)}><Icon.back size={18} /> Back</button>
        ) : editingId ? (
          <button className="btn ghost danger" onClick={() => removeEntry(editingId)}><Icon.trash size={18} /> Remove</button>
        ) : <span />}
        <div className="foot-right">
          {step > whatIndex && !isLast && canSave && (
            <button className="btn ghost" onClick={save}>Save now</button>
          )}
          {!isLast ? (
            <motion.button className="btn primary" disabled={step >= whatIndex && !canSave} onClick={() => go(step + 1)} whileTap={{ scale: 0.96 }}>
              Next <Icon.arrow size={18} />
            </motion.button>
          ) : (
            <motion.button className="btn primary" disabled={!canSave} onClick={save} whileTap={{ scale: 0.96 }}>
              <Icon.check size={18} /> {editingId ? 'Update' : 'Add to check-in'}
            </motion.button>
          )}
        </div>
      </footer>
    </Sheet>
  )
}
