import { motion } from 'framer-motion'
import { useMemo } from 'react'
import { regionById } from '../data/regions'
import { labelOf, ONSETS, QUALITIES, symptomLabel, intensityWord, PATTERNS } from '../data/symptoms'
import { nudgesFor } from '../logic/nudges'
import { LEVELS, triage } from '../logic/triage'
import { useStore, type Entry } from '../state/store'
import { BodyMap } from './BodyMap'
import { intensityColor } from './colors'
import { Icon } from './icons'
import { IconButton, Sheet, Stagger, item, spring } from './kit'

const LEVEL_ICON = [Icon.leaf, Icon.stethoscope, Icon.clock, Icon.phone]

/** Printing is unavailable inside sandboxed embeds (e.g. preview frames). */
const canPrint = (() => { try { return window.self === window.top } catch { return false } })()

export function UrgencyCard({ level, reasons, action }: { level: number; reasons: string[]; action: string }) {
  const L = LEVELS[level]
  const Ico = LEVEL_ICON[level]
  return (
    <motion.div variants={item} className={`urgency lvl-${level}`}>
      <div className="urgency-scale" aria-hidden>
        {LEVELS.map((_, i) => (
          <span key={i} className={i <= level ? 'on' : ''}>
            {i === level && <motion.i layoutId="urg-dot" transition={spring} />}
          </span>
        ))}
      </div>
      <div className="urgency-top">
        <span className="urgency-icon"><Ico size={22} /></span>
        <div>
          <div className="eyebrow">Suggested next step</div>
          <h3>{L.title}</h3>
        </div>
      </div>
      <p className="urgency-action">{action}</p>
      {level === 3 && (
        <a className="btn emergency" href="tel:112"><Icon.phone size={18} /> Call 112</a>
      )}
      <ul className="reasons">
        {reasons.map((r) => <li key={r}>{r}</li>)}
      </ul>
    </motion.div>
  )
}

export function EntryCard({ e, onEdit }: { e: Entry; onEdit?: () => void }) {
  const where = e.regionId === 'general' ? 'Whole body' : regionById(e.regionId).label
  const details = [
    e.qualities.map((q) => labelOf(QUALITIES, q).toLowerCase()).join(', '),
    e.onset && `since ${labelOf(ONSETS, e.onset).toLowerCase()}`,
    e.patterns.map((p) => labelOf(PATTERNS, p).toLowerCase()).join(', '),
  ].filter(Boolean).join(' · ')
  return (
    <motion.button variants={item} className="entry" onClick={onEdit} disabled={!onEdit} style={{ ['--ic' as string]: intensityColor(e.intensity) }}>
      <span className="entry-score"><b>{e.intensity}</b><small>{intensityWord(e.intensity)}</small></span>
      <span className="entry-main">
        <span className="entry-where">{where}</span>
        <span className="entry-what">{e.symptoms.map(symptomLabel).join(', ')}</span>
        {details && <span className="entry-detail">{details}</span>}
        {e.flags.length > 0 && <span className="entry-flag"><Icon.alert size={13} /> {e.flags.length} warning sign{e.flags.length > 1 ? 's' : ''}</span>}
        {e.notes && <span className="entry-note">“{e.notes}”</span>}
      </span>
    </motion.button>
  )
}

export function Nudges() {
  const profile = useStore((s) => s.profile)
  const list = useMemo(() => nudgesFor(profile), [profile])
  return (
    <div className="nudges">
      {list.map((n) => {
        const Ico = Icon[n.icon]
        return (
          <motion.div variants={item} key={n.id} className="nudge">
            <span className="nudge-icon"><Ico size={20} /></span>
            <span>
              <b>{n.title}</b>
              <small className="nudge-every">{n.every}</small>
              <span className="nudge-detail">{n.detail}</span>
            </span>
          </motion.div>
        )
      })}
      <motion.p variants={item} className="fine">General guidance; schedules differ by country. Check with your GP or local health service.</motion.p>
    </div>
  )
}

export function Summary() {
  const entries = useStore((s) => s.entries)
  const profile = useStore((s) => s.profile)
  const history = useStore((s) => s.history)
  const set = useStore((s) => s.set)
  const select = useStore((s) => s.select)
  const commit = useStore((s) => s.commitCheckIn)
  const t = useMemo(() => triage(entries, profile, history), [entries, profile, history])
  const close = () => set({ view: 'explore' })
  const date = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <Sheet label="Your summary" onClose={close} tall className="summary">
      <header className="sheet-head">
        <div>
          <div className="eyebrow">{date}</div>
          <h2>Your check-in</h2>
        </div>
        <IconButton label="Back to body" onClick={close}><Icon.close /></IconButton>
      </header>
      <div className="sheet-body scroll">
        <Stagger>
          {entries.length === 0 ? (
            <motion.div variants={item} className="empty">
              <Icon.sparkle size={28} />
              <p>Nothing logged yet. Tap anywhere on the body to describe how it feels, or use <b>Whole body</b> for things like fever or tiredness.</p>
              <button className="btn primary" onClick={close}>Explore the body</button>
            </motion.div>
          ) : (
            <>
              <UrgencyCard level={t.level} reasons={t.reasons} action={t.action} />
              <motion.h4 variants={item}>Body map</motion.h4>
              <motion.div variants={item} className="card map-card"><BodyMap entries={entries} /></motion.div>
              <motion.h4 variants={item}>What you told us <span className="count">{entries.length}</span></motion.h4>
              <div className="entries">
                {entries.map((e) => (
                  <EntryCard key={e.id} e={e} onEdit={() => select(e.regionId, e.point ? { point: e.point, normal: e.normal ?? [0, 0, 1] } : null, e.id)} />
                ))}
              </div>
            </>
          )}
          <motion.h4 variants={item}>Preventive check-ups for you</motion.h4>
          <Nudges />
          <motion.p variants={item} className="disclaimer">
            Soma is a prototype for self-reflection and does <b>not</b> give a diagnosis. If you are worried, or symptoms
            are severe or getting worse, contact a healthcare professional. In an emergency call 112 (EU) or 911 (US).
          </motion.p>
        </Stagger>
      </div>
      {entries.length > 0 && (
        <footer className="sheet-foot">
          {canPrint ? <button className="btn ghost" onClick={() => window.print()}><Icon.print size={18} /> Print for doctor</button> : <span />}
          <motion.button className="btn primary" whileTap={{ scale: 0.96 }} onClick={() => commit(t.level)}>
            <Icon.check size={18} /> Save check-in
          </motion.button>
        </footer>
      )}
    </Sheet>
  )
}
