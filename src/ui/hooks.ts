import { useEffect, useState } from 'react'
import { useStore } from '../state/store'

function useMedia(q: string) {
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(q).matches : false)
  const [m, setM] = useState(get)
  useEffect(() => {
    const mq = window.matchMedia(q)
    const on = () => setM(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [q])
  return m
}

export function useIsDark() {
  const theme = useStore((s) => s.theme)
  const sys = useMedia('(prefers-color-scheme: dark)')
  return theme === 'dark' || (theme === 'system' && sys)
}

export const useIsWide = () => useMedia('(min-width: 900px)')
export const useSystemReducedMotion = () => useMedia('(prefers-reduced-motion: reduce)')
