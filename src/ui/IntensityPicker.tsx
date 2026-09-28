import { animate, motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { useEffect } from 'react'
import { intensityWord } from '../data/symptoms'
import { intensityColor } from './colors'

/** A living face: the mouth, brows and cheeks follow the value. */
function Face({ v }: { v: number }) {
  const mv = useSpring(v, { stiffness: 260, damping: 26 })
  useEffect(() => { mv.set(v) }, [v, mv])
  const mouth = useTransform(mv, (x) => {
    const t = x / 10
    const curve = 7 - t * 14 // smile → frown
    const w = 9 - t * 2
    return `M ${24 - w} 31 Q 24 ${31 + curve} ${24 + w} 31`
  })
  const browL = useTransform(mv, (x) => `M 14 ${17 - x * 0.1} L 20 ${17 + x * 0.25}`)
  const browR = useTransform(mv, (x) => `M 34 ${17 - x * 0.1} L 28 ${17 + x * 0.25}`)
  const eyeRy = useTransform(mv, (x) => 2.4 - Math.max(0, x - 6) * 0.35)
  const cheek = useTransform(mv, (x) => Math.max(0, 0.5 - x * 0.08))
  const fill = useTransform(mv, (x) => intensityColor(x))
  return (
    <svg viewBox="0 0 48 48" className="face" aria-hidden>
      <motion.circle cx="24" cy="24" r="21" style={{ fill }} />
      <circle cx="24" cy="24" r="21" fill="url(#faceShine)" />
      <defs>
        <radialGradient id="faceShine" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#fff" stopOpacity=".55" />
          <stop offset=".6" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <motion.path d={browL} stroke="#1c2230" strokeWidth="2" strokeLinecap="round" fill="none" />
      <motion.path d={browR} stroke="#1c2230" strokeWidth="2" strokeLinecap="round" fill="none" />
      <motion.ellipse cx="17.5" cy="22.5" rx="2.2" ry={eyeRy} fill="#1c2230" />
      <motion.ellipse cx="30.5" cy="22.5" rx="2.2" ry={eyeRy} fill="#1c2230" />
      <motion.circle cx="12.5" cy="29" r="3" fill="#fff" style={{ opacity: cheek }} />
      <motion.circle cx="35.5" cy="29" r="3" fill="#fff" style={{ opacity: cheek }} />
      <motion.path d={mouth} stroke="#1c2230" strokeWidth="2.4" strokeLinecap="round" fill="none" />
    </svg>
  )
}

export function IntensityPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const display = useMotionValue(value)
  const rounded = useTransform(display, (x) => Math.round(x))
  useEffect(() => {
    const c = animate(display, value, { type: 'spring', stiffness: 300, damping: 30 })
    return c.stop
  }, [value, display])
  const pct = (value / 10) * 100
  return (
    <div className="intensity" style={{ ['--ic' as string]: intensityColor(value) }}>
      <div className="intensity-head">
        <Face v={value} />
        <div>
          <div className="intensity-num"><motion.span>{rounded}</motion.span><small>/10</small></div>
          <motion.div key={intensityWord(value)} className="intensity-word" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            {intensityWord(value)}
          </motion.div>
        </div>
      </div>
      <div className="range-wrap">
        <div className="range-fill" style={{ width: `calc(${pct}% + ${(0.5 - value / 10) * 34}px)` }} />
        <input
          type="range" min={0} max={10} step={1} value={value}
          aria-label="Intensity from 0 to 10"
          aria-valuetext={`${value} out of 10, ${intensityWord(value)}`}
          onChange={(e) => {
            const v = Number(e.target.value)
            if (v !== value && navigator.vibrate) try { navigator.vibrate(4) } catch { /* noop */ }
            onChange(v)
          }}
        />
        <div className="range-ticks" aria-hidden>
          {Array.from({ length: 11 }, (_, i) => <span key={i} className={i <= value ? 'on' : ''} />)}
        </div>
      </div>
      <div className="range-legend" aria-hidden><span>None</span><span>Moderate</span><span>Worst</span></div>
    </div>
  )
}
