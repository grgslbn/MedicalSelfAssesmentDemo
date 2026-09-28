import { AnimatePresence, motion, useDragControls, type PanInfo } from 'framer-motion'
import { useId, type ReactNode } from 'react'
import type { Option } from '../data/symptoms'
import { useIsWide } from './hooks'
import { Icon } from './icons'

export const spring = { type: 'spring', stiffness: 380, damping: 34, mass: 0.9 } as const
export const softSpring = { type: 'spring', stiffness: 220, damping: 30 } as const
export const ease = [0.22, 1, 0.36, 1] as const

export function Chips({ options, value, onChange, multi = true, tone }: {
  options: Option[]; value: string[]; onChange: (v: string[]) => void; multi?: boolean; tone?: 'alert'
}) {
  return (
    <div className="chips" role="group">
      {options.map((o, i) => {
        const on = value.includes(o.id)
        return (
          <motion.button
            key={o.id}
            type="button"
            className={`chip ${on ? 'on' : ''} ${tone ?? ''}`}
            aria-pressed={on}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: Math.min(i * 0.025, 0.3) }}
            whileTap={{ scale: 0.94 }}
            onClick={() => {
              if (multi) onChange(on ? value.filter((x) => x !== o.id) : [...value, o.id])
              else onChange(on ? [] : [o.id])
            }}
          >
            <AnimatePresence initial={false}>
              {on && (
                <motion.span className="chip-check" initial={{ width: 0, opacity: 0 }} animate={{ width: 16, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={spring}>
                  <Icon.check size={14} />
                </motion.span>
              )}
            </AnimatePresence>
            {o.label}
          </motion.button>
        )
      })}
    </div>
  )
}

export function Segmented<T extends string>({ options, value, onChange, size = 'md', label }: {
  options: { id: T; label: ReactNode; aria?: string }[]; value: T; onChange: (v: T) => void; size?: 'sm' | 'md'; label: string
}) {
  const id = useId()
  return (
    <div className={`seg seg-${size}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-label={o.aria} title={o.aria} aria-checked={value === o.id} className={value === o.id ? 'on' : ''} onClick={() => onChange(o.id)}>
          {value === o.id && <motion.span layoutId={`seg-${id}`} className="seg-pill" transition={spring} />}
          <span className="seg-label">{o.label}</span>
        </button>
      ))}
    </div>
  )
}

/**
 * Responsive panel: a draggable bottom sheet on phones, a floating side panel on wide screens.
 */
export function Sheet({ children, onClose, label, tall = false, className = '' }: {
  children: ReactNode; onClose?: () => void; label: string; tall?: boolean; className?: string
}) {
  const wide = useIsWide()
  const drag = useDragControls()
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (onClose && (info.offset.y > 120 || info.velocity.y > 600)) onClose()
  }
  return (
    <motion.section
      className={`sheet ${wide ? 'side' : 'bottom'} ${tall ? 'tall' : ''} ${className}`}
      role="dialog"
      aria-label={label}
      initial={wide ? { x: 40, opacity: 0 } : { y: '100%' }}
      animate={wide ? { x: 0, opacity: 1 } : { y: 0 }}
      exit={wide ? { x: 40, opacity: 0 } : { y: '100%' }}
      transition={spring}
      drag={!wide && onClose ? 'y' : false}
      dragListener={false}
      dragControls={drag}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0.05, bottom: 0.6 }}
      onDragEnd={onDragEnd}
    >
      {!wide && (
        <div className="grabber" onPointerDown={(e) => drag.start(e)}>
          <span />
        </div>
      )}
      {children}
    </motion.section>
  )
}

export function IconButton({ label, children, onClick, className = '' }: { label: string; children: ReactNode; onClick: () => void; className?: string }) {
  return (
    <motion.button type="button" className={`icon-btn ${className}`} aria-label={label} title={label} onClick={onClick} whileTap={{ scale: 0.9 }}>
      {children}
    </motion.button>
  )
}

export function Stagger({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.045, delayChildren: 0.05 } } }}>
      {children}
    </motion.div>
  )
}

export const item = {
  hidden: { opacity: 0, y: 14, filter: 'blur(4px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.55, ease } },
}
