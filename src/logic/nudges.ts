import { bmi, type Profile } from '../state/store'

export interface Nudge {
  id: string
  title: string
  detail: string
  every: string
  icon: 'heart' | 'drop' | 'scan' | 'sun' | 'eye' | 'shield' | 'tooth' | 'bone' | 'lungs' | 'scale'
}

/**
 * General preventive reminders, loosely based on common European/US guidance.
 * Schedules vary by country — the UI always says "check local guidelines".
 */
export function nudgesFor(p: Profile): Nudge[] {
  const n: Nudge[] = []
  const { age, sex, risks } = p
  const female = sex === 'female'
  const male = sex === 'male'
  const b = bmi(p)
  const risk = (r: string) => risks.includes(r)

  n.push({ id: 'bp', icon: 'heart', title: 'Blood pressure check', every: age >= 40 || risk('highBP') ? 'Every year' : 'Every 3–5 years',
    detail: 'High blood pressure has no symptoms. A quick cuff test at a pharmacy or GP catches it early.' })

  if (age >= 40 || risk('diabetes') || risk('familyHeart') || (male && age >= 35))
    n.push({ id: 'chol', icon: 'drop', title: 'Cholesterol & heart-risk check', every: 'Every 5 years',
      detail: 'A blood test plus a heart-risk score helps decide if lifestyle changes or treatment make sense.' })

  if ((age >= 35 && b >= 25) || risk('familyHeart') || age >= 45)
    n.push({ id: 'glucose', icon: 'drop', title: 'Blood sugar (diabetes) screen', every: 'Every 3 years',
      detail: b >= 25 ? `Your BMI is about ${b.toFixed(0)}, which makes a simple HbA1c test worthwhile.` : 'A simple HbA1c blood test detects pre-diabetes early.' })

  if (age >= 45 && age <= 75)
    n.push({ id: 'crc', icon: 'scan', title: 'Bowel cancer screening', every: 'Every 2 years (home test)',
      detail: 'A painless at-home stool test. Many countries mail it to you automatically.' })

  if (female && age >= 25 && age <= 65)
    n.push({ id: 'cervix', icon: 'shield', title: 'Cervical screening', every: age < 30 ? 'Every 3 years' : 'Every 3–5 years',
      detail: 'An HPV / smear test prevents most cervical cancers.' })

  if (female && age >= 40 && age <= 74)
    n.push({ id: 'breast', icon: 'scan', title: 'Mammogram', every: 'Every 2 years',
      detail: risk('familyCancer') ? 'With a family history, ask your doctor whether to start earlier.' : 'Breast screening finds cancers before they can be felt.' })

  if (male && age >= 50 && age <= 70)
    n.push({ id: 'prostate', icon: 'shield', title: 'Talk about prostate (PSA) testing', every: 'Discuss with your GP',
      detail: 'Testing has pros and cons — worth an informed conversation.' })

  if (risk('smoker') && age >= 50 && age <= 80)
    n.push({ id: 'lung', icon: 'lungs', title: 'Lung screening (low-dose CT)', every: 'Every year',
      detail: 'Recommended for current or recent heavy smokers in many countries.' })

  if (risk('smoker'))
    n.push({ id: 'quit', icon: 'lungs', title: 'Support to quit smoking', every: 'Any time',
      detail: 'Quitting at any age adds years. Free coaching and nicotine replacement roughly double success.' })

  if (male && risk('smoker') && age >= 65 && age <= 75)
    n.push({ id: 'aaa', icon: 'scan', title: 'Abdominal aorta ultrasound', every: 'Once',
      detail: 'A one-off scan checks for a silent swelling of the main artery.' })

  if (female && age >= 65)
    n.push({ id: 'bone', icon: 'bone', title: 'Bone density scan', every: 'Every 2 years',
      detail: 'Checks for osteoporosis before a fracture happens.' })

  n.push({ id: 'skin', icon: 'sun', title: 'Skin & mole self-check', every: 'Every 3 months',
    detail: 'Look for moles that change in size, shape or colour. Use the ABCDE rule.' })

  n.push({ id: 'eyes', icon: 'eye', title: 'Eye exam', every: age >= 60 || risk('diabetes') ? 'Every year' : 'Every 2 years',
    detail: risk('diabetes') ? 'Diabetes can affect the retina silently. A yearly eye check is key.' : 'Screens for glaucoma and vision changes.' })

  n.push({ id: 'dental', icon: 'tooth', title: 'Dental check-up', every: 'Every 6–12 months', detail: 'Gum health is linked to heart health too.' })

  n.push({ id: 'flu', icon: 'shield', title: age >= 65 ? 'Flu, COVID & pneumococcal vaccines' : 'Flu vaccine', every: 'Every autumn',
    detail: age >= 65 || risk('asthma') || risk('heart') || risk('diabetes') || risk('pregnant')
      ? 'You are in a group that is usually offered it for free.' : 'Recommended for most adults, especially if you care for others.' })

  if (b >= 30)
    n.push({ id: 'weight', icon: 'scale', title: 'Weight & activity plan', every: 'Talk to your GP',
      detail: 'Small, steady changes help more than any diet. Your GP can refer you to a programme.' })

  return n
}
