import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { RISKS } from '../data/symptoms'
import { useStore } from '../state/store'
import { Icon } from './icons'
import { Chips, Segmented, ease, spring } from './kit'
import { BmiNote, SEXES, Slider } from './Settings'

export function Onboarding() {
  const [step, setStep] = useState(0)
  const profile = useStore((s) => s.profile)
  const setProfile = useStore((s) => s.setProfile)
  const set = useStore((s) => s.set)
  const ready = useStore((s) => s.bodyReady)
  const finish = () => set({ onboarded: true })

  const steps = [
    <div key="0" className="ob-welcome">
      <motion.h1 initial={{ opacity: 0, y: 24, filter: 'blur(10px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 1.1, ease, delay: 0.2 }}>
        How does your body <em>feel</em> today?
      </motion.h1>
      <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease, delay: 0.45 }}>
        Tap where something feels off, describe it in a few taps, and get a calm summary with a clear next step,
        plus the check-ups that matter for you.
      </motion.p>
    </div>,
    <div key="1">
      <h2>A little about you</h2>
      <p className="hint">This tailors questions and preventive check-ups. It stays on your device.</p>
      <label className="field">
        <span className="field-top"><span>First name <span className="opt">optional</span></span></span>
        <input className="text" value={profile.name} placeholder="How should we greet you?" onChange={(e) => setProfile({ name: e.target.value })} />
      </label>
      <Slider label="Age" value={profile.age} min={16} max={100} unit="years" onChange={(v) => setProfile({ age: v })} />
      <div className="field">
        <span className="field-top"><span>Sex at birth</span></span>
        <Segmented label="Sex at birth" size="sm" value={profile.sex} onChange={(v) => setProfile({ sex: v })} options={SEXES} />
      </div>
    </div>,
    <div key="2">
      <h2>Your body in numbers</h2>
      <p className="hint">Roughly is fine.</p>
      <Slider label="Height" value={profile.heightCm} min={120} max={220} unit="cm" onChange={(v) => setProfile({ heightCm: v })} />
      <Slider label="Weight" value={profile.weightKg} min={35} max={200} unit="kg" onChange={(v) => setProfile({ weightKg: v })} />
      <BmiNote />
    </div>,
    <div key="3">
      <h2>Anything we should know?</h2>
      <p className="hint">Select any that apply, or skip.</p>
      <Chips options={RISKS.filter((r) => r.id !== 'pregnant' || profile.sex !== 'male')} value={profile.risks} onChange={(v) => setProfile({ risks: v })} />
    </div>,
  ]
  const last = step === steps.length - 1

  return (
    <motion.div className="onboarding" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: 30, transition: { duration: 0.5, ease } }}>
      <motion.div className="ob-brand" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease }}>
        <Logo /> Soma
      </motion.div>
      <motion.div className="ob-card" layout transition={spring}>
        {step > 0 && (
          <div className="ob-dots" aria-hidden>
            {[1, 2, 3].map((i) => <motion.span key={i} animate={{ width: i === step ? 22 : 6, opacity: i <= step ? 1 : 0.3 }} transition={spring} />)}
          </div>
        )}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={step} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.35, ease }}>
            {steps[step]}
          </motion.div>
        </AnimatePresence>
        <div className="ob-actions">
          {step > 0 ? <button className="btn ghost" onClick={() => setStep(step - 1)}><Icon.back size={18} /> Back</button> : <span />}
          <motion.button className="btn primary big" whileTap={{ scale: 0.96 }} onClick={() => (last ? finish() : setStep(step + 1))} disabled={!ready && step === 0}>
            {step === 0 ? (ready ? 'Get started' : 'Sculpting…') : last ? 'Start exploring' : 'Continue'} <Icon.arrow size={18} />
          </motion.button>
        </div>
        {step === 0 && <p className="fine center">Not a diagnosis. In an emergency, call 112 / 911.</p>}
      </motion.div>
    </motion.div>
  )
}

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="logo">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--accent-2)" />
          <stop offset="1" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="15" fill="url(#lg)" />
      <circle cx="16" cy="10" r="3.2" fill="#fff" fillOpacity=".95" />
      <path d="M9.5 15.5c4.2 1.6 8.8 1.6 13 0M16 17v4.5M16 21.5l-3 5M16 21.5l3 5" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" strokeOpacity=".95" />
    </svg>
  )
}
