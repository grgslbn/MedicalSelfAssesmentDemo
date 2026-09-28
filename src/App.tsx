import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { lazy, Suspense, useEffect, useState } from 'react'
import { regionById } from './data/regions'
import { triage } from './logic/triage'
import { useStore, type BodyStyle } from './state/store'
import { Icon } from './ui/icons'
import { IconButton, Segmented, ease, spring } from './ui/kit'
import { useIsDark, useSystemReducedMotion } from './ui/hooks'
import { Logo, Onboarding } from './ui/Onboarding'
import { ANATOMY_CREDIT } from './anatomy/data'
import { SymptomSheet } from './ui/SymptomSheet'
import { Summary } from './ui/Summary'
import { History } from './ui/History'
import { Settings } from './ui/Settings'

const Scene = lazy(() => import('./body/Scene'))

function greeting(name: string) {
  const h = new Date().getHours()
  const part = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
  return name ? `${part}, ${name}` : part
}

function TopBar() {
  const profile = useStore((s) => s.profile)
  const bodyStyle = useStore((s) => s.bodyStyle)
  const view = useStore((s) => s.view)
  const set = useStore((s) => s.set)
  const toggle = (v: 'history' | 'settings') => set({ view: view === v ? 'explore' : v, selected: null })
  return (
    <motion.header className="topbar" initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ ...spring, delay: 0.1 }}>
      <div className="brand">
        <Logo size={30} />
        <div>
          <b>Soma</b>
          <small>{greeting(profile.name)}</small>
        </div>
      </div>
      <div className="top-actions">
        <Segmented<BodyStyle> label="Body style" size="sm" value={bodyStyle} onChange={(v) => set({ bodyStyle: v })}
          options={[{ id: 'clay', aria: 'Clay', label: <><Icon.clay size={15} /><span className="hide-xs">Clay</span></> }, { id: 'glass', aria: 'Glass', label: <><Icon.glass size={15} /><span className="hide-xs">Glass</span></> }, { id: 'poly', aria: 'Low poly', label: <><Icon.poly size={15} /><span className="hide-xs">Poly</span></> }]} />
        <IconButton label="History" onClick={() => toggle('history')} className={view === 'history' ? 'on' : ''}><Icon.history /></IconButton>
        <IconButton label="Settings" onClick={() => toggle('settings')} className={view === 'settings' ? 'on' : ''}><Icon.settings /></IconButton>
      </div>
    </motion.header>
  )
}

function Dock() {
  const entries = useStore((s) => s.entries)
  const facing = useStore((s) => s.facing)
  const profile = useStore((s) => s.profile)
  const history = useStore((s) => s.history)
  const set = useStore((s) => s.set)
  const select = useStore((s) => s.select)
  const level = entries.length ? triage(entries, profile, history).level : -1
  const preview = useStore((s) => s.anatomyPreview)
  const progress = useStore((s) => s.anatomyProgress)
  const xray = useStore((s) => s.xray)
  const layers = useStore((s) => s.anatomyLayers)
  const loading = preview && progress < 1
  return (
    <motion.div className="dock-wrap" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={spring}>
      <AnimatePresence mode="wait">
        {xray ? (
          <motion.div key="layers" className="layer-chips" role="group" aria-label="Anatomy layers" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.4, ease }}>
            {(['bones', 'organs', 'muscles'] as const).map((l) => (
              <button key={l} className={layers[l] ? 'on' : ''} aria-pressed={layers[l]} onClick={() => set({ anatomyLayers: { ...layers, [l]: !layers[l] } })}>
                {l === 'bones' ? 'Bones' : l === 'organs' ? 'Organs' : 'Muscles'}
              </button>
            ))}
          </motion.div>
        ) : (
        <motion.div key={entries.length ? 'more' : 'first'} className="dock-hint" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.4, ease }}>
          <span className="hint-dot" />
          {entries.length ? 'Tap another spot, or review your check-in' : 'Tap where you feel something · drag to turn'}
        </motion.div>
        )}
      </AnimatePresence>
      <div className="dock">
        <motion.button className="dock-btn" whileTap={{ scale: 0.94 }} onClick={() => select('general')}>
          <Icon.body size={20} /><span>Whole body</span>
        </motion.button>
        <motion.button className="dock-btn" whileTap={{ scale: 0.94 }} onClick={() => set({ facing: facing === 'front' ? 'back' : 'front' })} aria-label={`Show ${facing === 'front' ? 'back' : 'front'}`}>
          <motion.span animate={{ rotateY: facing === 'back' ? 180 : 0 }} transition={spring} style={{ display: 'inline-flex' }}><Icon.flip size={20} /></motion.span>
          <span>{facing === 'front' ? 'Back' : 'Front'}</span>
        </motion.button>
        {preview && (
          <motion.button className={`dock-btn ${xray ? 'on' : ''}`} whileTap={{ scale: 0.94 }} disabled={loading} aria-pressed={xray}
            onClick={() => set({ xray: !xray })} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
            {loading ? <span className="mini-ring" style={{ ['--p' as string]: `${Math.round(progress * 100)}%` }} /> : <Icon.scan size={20} />}
            <span>{loading ? `${Math.round(progress * 100)}%` : 'X-ray'}</span>
          </motion.button>
        )}
        <motion.button className={`dock-btn primary ${entries.length ? '' : 'idle'}`} whileTap={{ scale: 0.94 }} onClick={() => set({ view: 'summary' })}>
          <span className="review-count">
            <AnimatePresence mode="popLayout">
              <motion.b key={entries.length} initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }} transition={spring}>{entries.length}</motion.b>
            </AnimatePresence>
            {level >= 0 && <i className={`lvl-dot lvl-${level}`} />}
          </span>
          <span>Review</span>
        </motion.button>
      </div>
    </motion.div>
  )
}

function Credit() {
  const preview = useStore((s) => s.anatomyPreview)
  return (
    <div className="credit">
      © Maria Rita Serpa Pinto · 2026
      {preview && <span className="credit-anatomy">{ANATOMY_CREDIT}</span>}
    </div>
  )
}

function HoverLabel() {
  const hovered = useStore((s) => s.hovered)
  const selected = useStore((s) => s.selected)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  useEffect(() => {
    const on = (e: PointerEvent) => setPos({ x: e.clientX, y: e.clientY })
    window.addEventListener('pointermove', on)
    return () => window.removeEventListener('pointermove', on)
  }, [])
  const hoverText = useStore((s) => s.hoverText)
  const show = (hovered && hovered !== selected) || hoverText
  return (
    <AnimatePresence>
      {show && (
        <motion.div className="hover-label" style={{ left: pos.x, top: pos.y }} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.18 }}>
          {hoverText ?? (hovered ? regionById(hovered).label : '')}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Loader() {
  const ready = useStore((s) => s.bodyReady)
  return (
    <AnimatePresence>
      {!ready && (
        <motion.div className="loader" exit={{ opacity: 0, transition: { duration: 0.8 } }}>
          <div className="loader-orb" />
          <span>Sculpting your body…</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default function App() {
  const onboarded = useStore((s) => s.onboarded)
  const anatomyPreview = useStore((s) => s.anatomyPreview)
  const view = useStore((s) => s.view)
  const selected = useStore((s) => s.selected)
  const theme = useStore((s) => s.theme)
  const reduced = useStore((s) => s.reducedMotion)
  const sysReduced = useSystemReducedMotion()
  const dark = useIsDark()
  const set = useStore((s) => s.set)

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#12161c' : '#f3efe9')
  }, [dark, theme])

  useEffect(() => { if (sysReduced && !reduced) set({ reducedMotion: true }) }, [sysReduced]) // eslint-disable-line react-hooks/exhaustive-deps

  // Escape closes the top-most panel
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const s = useStore.getState()
      if (s.selected) s.select(null)
      else if (s.view !== 'explore') s.set({ view: 'explore' })
      else if (s.xray) s.set({ xray: false })
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [])

  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>
      <div className={`app ${onboarded ? 'ready' : 'welcome'} ${anatomyPreview ? 'anatomy-on' : ''}`}>
        <Suspense fallback={null}><Scene /></Suspense>
        <Loader />
        <AnimatePresence>{onboarded && <TopBar key="top" />}</AnimatePresence>
        <AnimatePresence>{onboarded && view === 'explore' && !selected && <Dock key="dock" />}</AnimatePresence>
        <AnimatePresence>
          {onboarded && selected && <SymptomSheet key="sheet" />}
          {onboarded && !selected && view === 'summary' && <Summary key="summary" />}
          {onboarded && !selected && view === 'history' && <History key="history" />}
          {onboarded && !selected && view === 'settings' && <Settings key="settings" />}
        </AnimatePresence>
        <AnimatePresence>{!onboarded && <Onboarding key="ob" />}</AnimatePresence>
        <HoverLabel />
        <Credit />
      </div>
    </MotionConfig>
  )
}
