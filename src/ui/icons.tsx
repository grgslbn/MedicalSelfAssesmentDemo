import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }

const base = (size = 20): SVGProps<SVGSVGElement> => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
})

export const Icon = {
  settings: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>
  ),
  history: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" /><path d="M3.5 4.5v4h4" /><path d="M12 8v4.2l2.8 1.8" /></svg>
  ),
  close: ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>),
  back: ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M15 5l-7 7 7 7" /></svg>),
  arrow: ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>),
  flip: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><path d="M4 12c0-3 3.6-5 8-5s8 2 8 5-3.6 5-8 5" /><path d="M9 14l-3 3 3 3" /></svg>
  ),
  sparkle: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z" /><path d="M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" /></svg>
  ),
  body: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><circle cx="12" cy="4.5" r="2" /><path d="M6 8.5c2 .8 4 1.2 6 1.2s4-.4 6-1.2M12 9.7V15M12 15l-2.5 6M12 15l2.5 6" /></svg>
  ),
  check: ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M5 12.5l4.2 4.2L19 7" /></svg>),
  plus: ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M12 5v14M5 12h14" /></svg>),
  trash: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>
  ),
  print: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><path d="M7 9V3h10v6M7 18H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="7" y="14" width="10" height="7" rx="1" /></svg>
  ),
  alert: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><path d="M12 3.5l9.5 16.5h-19z" /><path d="M12 10v4.5M12 17.5v.01" /></svg>
  ),
  phone: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg>
  ),
  leaf: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15" /><path d="M5 19c3-4 6-7 10-9" /></svg>
  ),
  stethoscope: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><path d="M6 3v6a4 4 0 0 0 8 0V3" /><path d="M10 13v2a5 5 0 0 0 10 0v-2" /><circle cx="20" cy="11" r="2" /></svg>
  ),
  clock: ({ size, ...p }: P) => (<svg {...base(size)} {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>),
  heart: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><path d="M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10z" /><path d="M7 12h2.5l1.2-2 2 4 1.3-2H17" /></svg>
  ),
  drop: ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M12 3.5c3.5 4.2 6 7.5 6 10.5a6 6 0 0 1-12 0c0-3 2.5-6.3 6-10.5z" /></svg>),
  scan: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><circle cx="12" cy="12" r="3" /></svg>
  ),
  sun: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><circle cx="12" cy="12" r="3.5" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" /></svg>
  ),
  eye: ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" /></svg>),
  shield: ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6z" /><path d="M9 12l2 2 4-4" /></svg>),
  tooth: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><path d="M7.5 4C5 4 4 6 4 8c0 3 1.5 4 2 7s1 6 2.5 6S10 16 12 16s2 5 3.5 5 2-3 2.5-6 2-4 2-7c0-2-1-4-3.5-4-2 0-3 1-4.5 1S9.5 4 7.5 4z" /></svg>
  ),
  bone: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><path d="M8.5 9.5l6 6M6.5 11.5a2.5 2.5 0 1 1-2-4 2.5 2.5 0 1 1 4-2l6 6a2.5 2.5 0 1 1 4 2 2.5 2.5 0 1 1-2 4z" /></svg>
  ),
  lungs: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><path d="M12 4v8M12 9c-1 1-2 1.5-3 1.5M12 9c1 1 2 1.5 3 1.5" /><path d="M8.5 7C5 7 3.5 12 3.5 16c0 2.5 1.5 3.5 3 3.5 2.5 0 3.5-1.5 3.5-4V9" /><path d="M15.5 7c3.5 0 5 5 5 9 0 2.5-1.5 3.5-3 3.5-2.5 0-3.5-1.5-3.5-4V9" /></svg>
  ),
  scale: ({ size, ...p }: P) => (<svg {...base(size)} {...p}><rect x="3.5" y="3.5" width="17" height="17" rx="4" /><path d="M8.5 9a5 5 0 0 1 7 0l-2.2 2.6" /></svg>),
  moon: ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg>),
  clay: ({ size, ...p }: P) => (<svg {...base(size)} {...p}><circle cx="12" cy="12" r="8" fill="currentColor" fillOpacity=".22" /></svg>),
  poly: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><path d="M12 3.5l7.5 4.5v8L12 20.5 4.5 16V8z" /><path d="M12 3.5l-2.5 9 9.5 3.5M9.5 12.5L4.5 16M9.5 12.5l2.5 8M9.5 12.5L4.5 8M19.5 8l-10 4.5" /></svg>
  ),
  glass: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><circle cx="12" cy="12" r="8" /><path d="M8.5 9.5a4.5 4.5 0 0 1 3-2.5" /></svg>
  ),
}
