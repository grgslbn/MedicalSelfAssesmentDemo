import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'

export type Sex = 'female' | 'male' | 'intersex' | 'unspecified'
export type BodyStyle = 'clay' | 'glass' | 'poly'
export type Theme = 'system' | 'light' | 'dark'
export type View = 'explore' | 'summary' | 'history' | 'settings'

export interface Profile {
  name: string
  age: number
  sex: Sex
  heightCm: number
  weightKg: number
  risks: string[]
}

export interface Entry {
  id: string
  regionId: string // region id or 'general'
  point?: [number, number, number]
  normal?: [number, number, number]
  symptoms: string[]
  intensity: number
  qualities: string[]
  onset: string
  patterns: string[]
  flags: string[]
  notes: string
  createdAt: number
  /** V0.2: the exact anatomical structure, when the user picked one */
  structure?: { id: number; label: string }
}

export interface CheckIn {
  id: string
  date: number
  entries: Entry[]
  level: number
  peak: number
}

interface State {
  onboarded: boolean
  profile: Profile
  bodyStyle: BodyStyle
  theme: Theme
  reducedMotion: boolean
  entries: Entry[]
  history: CheckIn[]
  /** V0.2 anatomy preview (Settings toggle, off by default) */
  anatomyPreview: boolean
  anatomyLayers: { bones: boolean; organs: boolean; muscles: boolean }

  // transient UI
  view: View
  selected: string | null // region id or 'general'
  pendingPoint: { point: [number, number, number]; normal: [number, number, number] } | null
  editingId: string | null
  hovered: string | null
  facing: 'front' | 'back'
  bodyReady: boolean
  openCheckIn: string | null
  xray: boolean
  anatomyProgress: number // 0..1 while loading, 1 when ready
  /** structure picked in 3D or in the sheet, highlighted on the model */
  focusStructure: number | null
  hoverText: string | null

  set: (p: Partial<State>) => void
  setProfile: (p: Partial<Profile>) => void
  select: (regionId: string | null, hit?: State['pendingPoint'], editingId?: string | null) => void
  saveEntry: (e: Omit<Entry, 'id' | 'createdAt'>) => void
  removeEntry: (id: string) => void
  commitCheckIn: (level: number) => void
  resetAll: () => void
}

const safeStorage: StateStorage = {
  getItem: (k) => { try { return localStorage.getItem(k) } catch { return null } },
  setItem: (k, v) => { try { localStorage.setItem(k, v) } catch { /* private mode */ } },
  removeItem: (k) => { try { localStorage.removeItem(k) } catch { /* noop */ } },
}

const uid = () => Math.random().toString(36).slice(2, 10)

export const DEFAULT_PROFILE: Profile = { name: '', age: 38, sex: 'unspecified', heightCm: 172, weightKg: 70, risks: [] }

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      onboarded: false,
      profile: DEFAULT_PROFILE,
      bodyStyle: 'clay',
      theme: 'system',
      reducedMotion: false,
      entries: [],
      history: [],
      anatomyPreview: false,
      anatomyLayers: { bones: true, organs: true, muscles: false },

      view: 'explore',
      selected: null,
      pendingPoint: null,
      editingId: null,
      hovered: null,
      facing: 'front',
      bodyReady: false,
      openCheckIn: null,
      xray: false,
      anatomyProgress: 0,
      focusStructure: null,
      hoverText: null,

      set: (p) => set(p),
      setProfile: (p) => set({ profile: { ...get().profile, ...p } }),
      select: (regionId, hit = null, editingId = null) =>
        set({ selected: regionId, pendingPoint: hit, editingId, focusStructure: editingId ? get().entries.find((e) => e.id === editingId)?.structure?.id ?? null : null }),
      saveEntry: (e) => {
        const { editingId, entries } = get()
        if (editingId) {
          set({ entries: entries.map((x) => (x.id === editingId ? { ...x, ...e } : x)) })
        } else {
          set({ entries: [...entries, { ...e, id: uid(), createdAt: Date.now() }] })
        }
        set({ selected: null, pendingPoint: null, editingId: null, focusStructure: null })
      },
      removeEntry: (id) => set({ entries: get().entries.filter((x) => x.id !== id), selected: null, editingId: null }),
      commitCheckIn: (level) => {
        const { entries, history } = get()
        if (!entries.length) return
        const peak = Math.max(...entries.map((e) => e.intensity))
        set({
          history: [{ id: uid(), date: Date.now(), entries, level, peak }, ...history],
          entries: [],
          view: 'history',
        })
      },
      resetAll: () =>
        set({ onboarded: false, profile: DEFAULT_PROFILE, entries: [], history: [], view: 'explore', selected: null }),
    }),
    {
      name: 'soma.v1',
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({
        onboarded: s.onboarded, profile: s.profile, bodyStyle: s.bodyStyle, theme: s.theme,
        reducedMotion: s.reducedMotion, entries: s.entries, history: s.history,
        anatomyPreview: s.anatomyPreview, anatomyLayers: s.anatomyLayers,
      }),
    },
  ),
)

export function bmi(p: Profile) {
  const m = p.heightCm / 100
  return m > 0 ? p.weightKg / (m * m) : 0
}
