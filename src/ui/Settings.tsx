import { motion } from 'framer-motion'
import { useState } from 'react'
import { RISKS } from '../data/symptoms'
import { bmi, useStore, type BodyStyle, type Sex, type Theme } from '../state/store'
import { Icon } from './icons'
import { Chips, IconButton, Segmented, Sheet, Stagger, item } from './kit'

export const SEXES: { id: Sex; label: string }[] = [
  { id: 'female', label: 'Female' }, { id: 'male', label: 'Male' }, { id: 'intersex', label: 'Intersex' }, { id: 'unspecified', label: 'Rather not say' },
]

export function Slider({ label, value, min, max, step = 1, unit, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; unit: string; onChange: (v: number) => void
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <label className="field slider">
      <span className="field-top"><span>{label}</span><b>{value}<small> {unit}</small></b></span>
      <span className="slim-range" style={{ ['--p' as string]: `${pct}%` }}>
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      </span>
    </label>
  )
}

export function BmiNote() {
  const profile = useStore((s) => s.profile)
  const b = bmi(profile)
  const cat = b < 18.5 ? 'below the usual range' : b < 25 ? 'in the healthy range' : b < 30 ? 'slightly above the usual range' : 'above the usual range'
  return <p className="bmi">BMI <b>{b.toFixed(1)}</b>: {cat}. BMI is a rough guide and doesn’t account for muscle.</p>
}

export function Settings() {
  const s = useStore()
  const [confirm, setConfirm] = useState(false)
  const close = () => s.set({ view: 'explore' })
  return (
    <Sheet label="Settings" onClose={close} tall>
      <header className="sheet-head">
        <div>
          <div className="eyebrow">Personalise</div>
          <h2>Settings</h2>
        </div>
        <IconButton label="Close" onClick={close}><Icon.close /></IconButton>
      </header>
      <div className="sheet-body scroll">
        <Stagger>
          <motion.h4 variants={item}>About you</motion.h4>
          <motion.div variants={item} className="card form">
            <label className="field">
              <span className="field-top"><span>First name <span className="opt">optional</span></span></span>
              <input className="text" value={s.profile.name} placeholder="How should we greet you?" onChange={(e) => s.setProfile({ name: e.target.value })} />
            </label>
            <Slider label="Age" value={s.profile.age} min={16} max={100} unit="years" onChange={(v) => s.setProfile({ age: v })} />
            <div className="field">
              <span className="field-top"><span>Sex at birth</span></span>
              <Segmented label="Sex at birth" size="sm" value={s.profile.sex} onChange={(v) => s.setProfile({ sex: v })} options={SEXES} />
            </div>
            <Slider label="Height" value={s.profile.heightCm} min={120} max={220} unit="cm" onChange={(v) => s.setProfile({ heightCm: v })} />
            <Slider label="Weight" value={s.profile.weightKg} min={35} max={200} unit="kg" onChange={(v) => s.setProfile({ weightKg: v })} />
            <BmiNote />
          </motion.div>

          <motion.h4 variants={item}>Health background</motion.h4>
          <motion.div variants={item} className="card">
            <Chips options={RISKS} value={s.profile.risks} onChange={(v) => s.setProfile({ risks: v })} />
          </motion.div>

          <motion.h4 variants={item}>Appearance</motion.h4>
          <motion.div variants={item} className="card form">
            <div className="field">
              <span className="field-top"><span>Body style</span></span>
              <Segmented<BodyStyle> label="Body style" value={s.bodyStyle} onChange={(v) => s.set({ bodyStyle: v })}
                options={[{ id: 'clay', label: <><Icon.clay size={16} /> Clay</> }, { id: 'glass', label: <><Icon.glass size={16} /> Glass</> }, { id: 'poly', label: <><Icon.poly size={16} /> Low poly</> }]} />
            </div>
            <div className="field">
              <span className="field-top"><span>Theme</span></span>
              <Segmented<Theme> label="Theme" value={s.theme} onChange={(v) => s.set({ theme: v })}
                options={[{ id: 'system', label: 'Auto' }, { id: 'light', label: <><Icon.sun size={16} /> Light</> }, { id: 'dark', label: <><Icon.moon size={16} /> Dark</> }]} />
            </div>
            <label className="switch-row">
              <span>Reduce motion</span>
              <input type="checkbox" className="switch" checked={s.reducedMotion} onChange={(e) => s.set({ reducedMotion: e.target.checked })} />
            </label>
          </motion.div>

          <motion.h4 variants={item}>Your data</motion.h4>
          <motion.div variants={item} className="card">
            <p className="fine" style={{ marginTop: 0 }}>Everything stays on this device, in your browser. Nothing is sent anywhere.</p>
            {!confirm ? (
              <button className="btn ghost danger" onClick={() => setConfirm(true)}><Icon.trash size={18} /> Erase all my data</button>
            ) : (
              <div className="confirm">
                <span>Erase profile, current check-in and history?</span>
                <button className="btn ghost" onClick={() => setConfirm(false)}>Cancel</button>
                <button className="btn danger-solid" onClick={() => { s.resetAll(); setConfirm(false) }}>Erase</button>
              </div>
            )}
          </motion.div>
          <motion.p variants={item} className="disclaimer">
            Soma is a design prototype. It is not a medical device and does not provide a diagnosis. In an emergency call 112 (EU) or 911 (US).
          </motion.p>
        </Stagger>
      </div>
    </Sheet>
  )
}
