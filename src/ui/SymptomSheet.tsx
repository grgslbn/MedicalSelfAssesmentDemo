import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { regionById } from '../data/regions'
import { ONSETS, PATTERNS, QUALITIES, redFlagsFor, symptomsFor } from '../data/symptoms'
import { useStore, type Entry } from '../state/store'
import { intensityColor } from './colors'
import { Icon } from './icons'
import { IntensityPicker } from './IntensityPicker'
import { Chips, IconButton, Sheet, ease, spring } from './kit'

const STEPS = ['What', 'How much', 'Since when', 'Anything else']

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

      {others.length > 0 && step === 0 && (
        <div className="already">
          Already logged here:{' '}
          {others.map((o) => (
            <button key={o.id} className="mini-pill" style={{ ['--ic' as string]: intensityColor(o.intensity) }} onClick={() => select(o.regionId, { point: o.point!, normal: o.normal! }, o.id)}>
              {o.intensity}/10 · edit
            </button>
          ))}
        </div>
      )}

      <nav className="stepper" aria-label="Steps">
        {STEPS.map((s, i) => (
          <button key={s} className={`step ${i === step ? 'on' : ''} ${i < step ? 'done' : ''}`} onClick={() => (i === 0 || canSave) && go(i)} aria-current={i === step}>
            <span className="bar"><motion.span initial={false} animate={{ scaleX: i <= step ? 1 : 0 }} transition={spring} /></span>
            <span className="lbl">{s}</span>
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
            {step === 0 && (
              <>
                <h3>What do you feel?</h3>
                <p className="hint">Pick everything that fits.</p>
                <Chips options={symptoms} value={draft.symptoms} onChange={(v) => up({ symptoms: v })} />
              </>
            )}
            {step === 1 && (
              <>
                <h3>How strong is it right now?</h3>
                <IntensityPicker value={draft.intensity} onChange={(v) => up({ intensity: v })} />
                <h4>What is it like? <span className="opt">optional</span></h4>
                <Chips options={QUALITIES} value={draft.qualities} onChange={(v) => up({ qualities: v })} />
              </>
            )}
            {step === 2 && (
              <>
                <h3>Since when?</h3>
                <Chips options={ONSETS} value={draft.onset ? [draft.onset] : []} multi={false} onChange={(v) => up({ onset: v[0] ?? '' })} />
                <h4>How does it behave? <span className="opt">optional</span></h4>
                <Chips options={PATTERNS} value={draft.patterns} onChange={(v) => up({ patterns: v })} />
              </>
            )}
            {step === 3 && (
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
          {step > 0 && step < 3 && canSave && (
            <button className="btn ghost" onClick={save}>Save now</button>
          )}
          {step < 3 ? (
            <motion.button className="btn primary" disabled={!canSave} onClick={() => go(step + 1)} whileTap={{ scale: 0.96 }}>
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
