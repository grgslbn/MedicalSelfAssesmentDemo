import type { RegionGroup } from './regions'

export interface Option { id: string; label: string; emoji?: string }

const o = (id: string, label: string): Option => ({ id, label })

const COMMON = [o('pain', 'Pain'), o('ache', 'Ache'), o('stiffness', 'Stiffness'), o('swelling', 'Swelling'),
  o('numbness', 'Numbness'), o('tingling', 'Tingling'), o('weakness', 'Weakness'), o('itch', 'Itching'),
  o('rash', 'Rash or redness'), o('bruise', 'Bruise'), o('lump', 'Lump')]

const JOINT = [o('clicking', 'Clicking'), o('locking', 'Locking'), o('limited', 'Limited movement'), o('unstable', 'Feels unstable')]

const SPECIFIC: Record<RegionGroup, Option[]> = {
  head: [o('headache', 'Headache'), o('dizziness', 'Dizziness'), o('blurred', 'Blurred vision'), o('earache', 'Ear pain'),
    o('congestion', 'Blocked nose'), o('toothache', 'Toothache'), o('jaw', 'Jaw pain')],
  neck: [o('soreThroat', 'Sore throat'), o('stiffNeck', 'Stiff neck'), o('glands', 'Swollen glands'), o('hoarse', 'Hoarse voice'),
    o('swallow', 'Hard to swallow')],
  chest: [o('tightness', 'Tightness / pressure'), o('palpitations', 'Racing heart'), o('cough', 'Cough'),
    o('breathless', 'Short of breath'), o('heartburn', 'Heartburn')],
  upperBack: [o('tension', 'Muscle tension'), o('breathPain', 'Hurts to breathe in')],
  abdomen: [o('cramps', 'Cramps'), o('bloating', 'Bloating'), o('nausea', 'Nausea'), o('heartburn', 'Heartburn'),
    o('diarrhoea', 'Diarrhoea'), o('constipation', 'Constipation')],
  lowerBack: [o('shooting', 'Pain down the leg'), o('morningStiff', 'Stiff in the morning')],
  pelvis: [o('urination', 'Pain when peeing'), o('frequent', 'Peeing often'), o('groin', 'Groin pain'), o('period', 'Period pain')],
  glutes: [o('sciatica', 'Pain down the leg'), o('sitting', 'Hurts to sit')],
  shoulder: JOINT,
  upperArm: [o('cramp', 'Cramp')],
  forearm: [...JOINT.slice(0, 3), o('grip', 'Weak grip')],
  hand: [o('pinsNeedles', 'Pins & needles'), o('cold', 'Cold fingers'), o('grip', 'Weak grip'), o('jointHand', 'Painful joints')],
  thigh: [o('cramp', 'Cramp')],
  knee: JOINT,
  shin: [o('cramp', 'Cramp'), o('calfSwelling', 'Swollen calf'), o('varicose', 'Visible veins')],
  foot: [o('heel', 'Heel pain'), o('cold', 'Cold feet'), o('pinsNeedles', 'Pins & needles'), o('ankleSwelling', 'Swollen ankle')],
}

export function symptomsFor(group: RegionGroup | 'general', sex?: string): Option[] {
  if (group === 'general') return GENERAL
  let specific = SPECIFIC[group]
  if (group === 'pelvis' && sex === 'male') specific = specific.filter((s) => s.id !== 'period')
  const ids = new Set(specific.map((s) => s.id))
  return [...specific, ...COMMON.filter((c) => !ids.has(c.id))]
}

export const GENERAL: Option[] = [o('fever', 'Fever'), o('fatigue', 'Tiredness'), o('chills', 'Chills'), o('nightSweats', 'Night sweats'),
  o('weightLoss', 'Unexplained weight loss'), o('sleep', 'Poor sleep'), o('lowMood', 'Low mood'), o('anxiety', 'Anxiety'),
  o('appetite', 'Loss of appetite'), o('dizziness', 'Dizziness'), o('thirst', 'Very thirsty')]

export const QUALITIES: Option[] = [o('sharp', 'Sharp'), o('dull', 'Dull'), o('burning', 'Burning'), o('throbbing', 'Throbbing'),
  o('stabbing', 'Stabbing'), o('cramping', 'Cramping'), o('pressing', 'Pressing'), o('shooting', 'Shooting')]

export const ONSETS: Option[] = [o('now', 'Just now'), o('today', 'Today'), o('days', 'A few days'), o('weeks', '1–2 weeks'),
  o('month', 'Over a month'), o('months', 'Months or more')]

export const PATTERNS: Option[] = [o('constant', 'Constant'), o('comesGoes', 'Comes & goes'), o('movement', 'Worse when moving'),
  o('night', 'Worse at night'), o('eating', 'After eating'), o('injury', 'After an injury'), o('better', 'Getting better'),
  o('worse', 'Getting worse')]

/** Red flags — asked on the last step. Any tick raises the urgency. */
export const RED_FLAGS: (Option & { groups: (RegionGroup | 'general')[] })[] = [
  { id: 'breathing', label: 'Struggling to breathe', groups: ['general', 'chest', 'neck', 'upperBack'] },
  { id: 'radiating', label: 'Pain spreads to arm, jaw or back', groups: ['chest', 'upperBack', 'shoulder', 'upperArm', 'neck'] },
  { id: 'fainted', label: 'Fainted or nearly fainted', groups: ['general', 'head', 'chest'] },
  { id: 'oneSide', label: 'Sudden weakness or numbness on one side', groups: ['general', 'head', 'upperArm', 'forearm', 'hand', 'thigh', 'shin', 'foot'] },
  { id: 'speech', label: 'Face drooping or slurred speech', groups: ['general', 'head', 'neck'] },
  { id: 'worstHeadache', label: 'Worst headache of my life, came on suddenly', groups: ['head'] },
  { id: 'confusion', label: 'Confused or very drowsy', groups: ['general', 'head'] },
  { id: 'highFever', label: 'Fever above 39 °C', groups: ['general', 'head', 'neck', 'chest', 'abdomen'] },
  { id: 'blood', label: 'Vomiting or coughing blood', groups: ['chest', 'abdomen', 'neck'] },
  { id: 'rigid', label: 'Belly is hard and very tender', groups: ['abdomen', 'pelvis'] },
  { id: 'hotLimb', label: 'Swollen, hot and red limb', groups: ['shin', 'thigh', 'forearm', 'upperArm', 'foot'] },
  { id: 'bladder', label: 'Loss of bladder or bowel control', groups: ['lowerBack', 'pelvis', 'glutes'] },
  { id: 'injury', label: 'Can’t put weight on it after a fall', groups: ['knee', 'foot', 'shin', 'thigh', 'glutes'] },
]

export const redFlagsFor = (g: RegionGroup | 'general') => RED_FLAGS.filter((r) => r.groups.includes(g))

export const RISKS: Option[] = [o('smoker', 'I smoke'), o('diabetes', 'Diabetes'), o('highBP', 'High blood pressure'),
  o('heart', 'Heart condition'), o('asthma', 'Asthma / COPD'), o('pregnant', 'Pregnant'), o('familyCancer', 'Family history of cancer'),
  o('familyHeart', 'Family history of heart disease')]

export function labelOf(list: Option[], id: string) {
  return list.find((x) => x.id === id)?.label ?? id
}

const ALL_SYMPTOMS = new Map<string, string>()
for (const g of Object.values(SPECIFIC)) for (const s of g) ALL_SYMPTOMS.set(s.id, s.label)
for (const s of [...COMMON, ...GENERAL]) ALL_SYMPTOMS.set(s.id, s.label)
export const symptomLabel = (id: string) => ALL_SYMPTOMS.get(id) ?? id

export function intensityWord(v: number) {
  if (v <= 0) return 'No pain'
  if (v <= 3) return 'Mild'
  if (v <= 6) return 'Moderate'
  if (v <= 8) return 'Severe'
  return 'Worst imaginable'
}
