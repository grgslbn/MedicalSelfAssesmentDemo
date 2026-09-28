import type { Entry, Profile } from '../state/store'
import { regionById } from '../data/regions'

export type Level = 0 | 1 | 2 | 3

export interface Triage {
  level: Level
  title: string
  action: string
  reasons: string[]
}

export const LEVELS = [
  { key: 'selfcare', title: 'Self-care', short: 'Look after yourself', action: 'Rest, keep an eye on it, and check in again if it changes or doesn’t improve within a few days.' },
  { key: 'gp', title: 'See a GP', short: 'Book an appointment', action: 'Book a routine appointment with your doctor in the coming days. Bring this summary along.' },
  { key: 'urgent', title: 'Urgent care', short: 'Get seen today', action: 'Contact an urgent care service or out-of-hours doctor today.' },
  { key: 'emergency', title: 'Emergency', short: 'Call 112 / 911 now', action: 'Call your local emergency number (112 in Europe, 911 in the US) or go to the nearest emergency department now.' },
] as const

/** “in your left knee” / “overall” */
const inYour = (e: Entry) => (e.regionId === 'general' ? 'overall' : `in your ${regionById(e.regionId)?.label.toLowerCase()}`)
const yourZone = (e: Entry) => (e.regionId === 'general' ? 'your general symptoms' : `your ${regionById(e.regionId)?.label.toLowerCase()}`)

/**
 * A deliberately conservative, rule-based hint. Illustrative only —
 * NOT a clinically validated triage algorithm.
 */
export function triage(entries: Entry[], profile: Profile, history: { entries: Entry[] }[] = []): Triage {
  let level: Level = 0
  const reasons: string[] = []
  const bump = (l: Level, why: string) => {
    if (l > level) level = l
    reasons.push(why)
  }

  const flagText: Record<string, [Level, string]> = {
    breathing: [3, 'Difficulty breathing needs immediate help.'],
    radiating: [3, 'Pain spreading to the arm, jaw or back can be a sign of a heart problem.'],
    oneSide: [3, 'Sudden one-sided weakness or numbness can be a sign of a stroke.'],
    speech: [3, 'A drooping face or slurred speech can be a sign of a stroke.'],
    worstHeadache: [3, 'A sudden, severe “thunderclap” headache must be checked straight away.'],
    confusion: [3, 'New confusion or drowsiness needs urgent assessment.'],
    blood: [3, 'Vomiting or coughing up blood needs urgent assessment.'],
    rigid: [3, 'A hard, very tender belly can signal a surgical emergency.'],
    bladder: [3, 'Losing bladder or bowel control with back pain needs to be checked immediately.'],
    fainted: [2, 'Fainting should be looked at by a doctor today.'],
    highFever: [2, 'A fever above 39 °C should be assessed today.'],
    hotLimb: [2, 'A swollen, hot, red limb can be a clot or infection.'],
    injury: [2, 'Not being able to bear weight after a fall may mean a fracture.'],
  }

  for (const e of entries) {
    for (const f of e.flags) if (flagText[f]) bump(...flagText[f])
    const r = e.regionId === 'general' ? null : regionById(e.regionId)
    const has = (...ids: string[]) => ids.some((i) => e.symptoms.includes(i))

    if (r?.group === 'chest' && (has('tightness', 'pain', 'ache') || e.qualities.includes('pressing')) && e.intensity >= 6)
      bump(3, `Strong chest pain or pressure (${e.intensity}/10) should always be checked urgently.`)
    else if (r?.group === 'chest' && has('breathless')) bump(2, 'New shortness of breath should be seen today.')
    else if (r?.group === 'chest' && has('palpitations')) bump(1, 'A racing heart is worth discussing with your doctor.')

    if (r?.group === 'abdomen' && e.intensity >= 7) bump(2, `Severe abdominal pain (${e.intensity}/10) should be assessed today.`)

    if (e.intensity >= 8) bump(2, `Severe symptoms ${inYour(e)} (${e.intensity}/10).`)
    else if (e.intensity >= 5) bump(1, `Moderate symptoms ${inYour(e)} (${e.intensity}/10).`)

    if (['month', 'months'].includes(e.onset)) bump(1, `Symptoms ${inYour(e)} have lasted over a month.`)
    if (e.patterns.includes('worse') && e.intensity >= 4) bump(1, `Symptoms ${inYour(e)} are getting worse.`)
    if (has('weightLoss', 'lump', 'nightSweats')) bump(1, 'Unexplained weight loss, lumps or night sweats should be checked by a doctor.')
    if (has('fever') && profile.age >= 65) bump(2, 'Fever at 65+ deserves a same-day check.')
    if (has('fever') && profile.risks.includes('pregnant')) bump(2, 'Fever during pregnancy should be assessed today.')
    if (has('calfSwelling') && e.intensity >= 3) bump(2, 'A painful, swollen calf can be a blood clot.')
  }

  // Recurring zone across previous check-ins
  const past = new Map<string, number>()
  for (const c of history.slice(0, 6)) for (const e of new Set(c.entries.map((x) => x.regionId))) past.set(e, (past.get(e) ?? 0) + 1)
  for (const e of entries) {
    const n = past.get(e.regionId) ?? 0
    if (n >= 2) bump(1, `${yourZone(e).replace(/^y/, 'Y')} came up in ${n + 1} check-ins, a pattern worth discussing.`)
  }

  const L = LEVELS[level]
  if (!reasons.length) reasons.push('Nothing you told us suggests an urgent problem.')
  return { level, title: L.title, action: L.action, reasons: [...new Set(reasons)].slice(0, 5) }
}
