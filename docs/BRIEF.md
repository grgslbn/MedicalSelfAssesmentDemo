# Soma — a gentle body check-in

*Design & product brief for an interactive, 3D medical self-assessment prototype.*

---

## 1. The idea, restated

People notice things in their bodies long before they talk to a doctor: a nagging
knee, a headache that keeps coming back, tiredness that never quite lifts. Most of
these signals are forgotten, downplayed, or described vaguely once the patient is
finally in front of a clinician.

**Soma** is a calm, playful place to *check in with your body*. Instead of a form,
you explore a 3D figure, tap where something feels off, and describe it with a few
taps: what it feels like, how strong it is, since when. Soma turns that into a
clear body map, a careful hint about *how soon* to seek care, and age- and
sex-appropriate preventive check-up reminders. Over time the check-ins become a
personal health diary you can hand to a doctor.

> Soma supports preventive medicine: it lowers the threshold to notice, record and
> act on early signals, and reminds people of routine screenings they'd otherwise
> skip. **It is not a diagnostic tool.**

## 2. Who it's for

| | |
|---|---|
| **Primary user** | General public, 18+, on a phone. Often mildly worried, in a hurry, or not medically literate. |
| **Context** | On the sofa, on the bus, the night before a GP appointment. One hand, short attention span. |
| **Secondary** | The clinician who receives the printed/shared summary. |

**Design implications:** it has to feel friendly rather than clinical, so no gore,
no anatomy that scares. Touch targets need to be big, and everything should be
readable in 2 seconds. Every screen must be usable one-handed, and nothing should
ever require typing.

## 3. Principles

1. **Explore, don't fill in.** The body *is* the interface. Tapping replaces forms.
2. **Calm by default.** Warm neutrals, soft light, slow easing. Alarm colours are
   reserved for real red flags.
3. **Always a next step.** Every assessment ends with one clear action (self-care,
   GP, urgent care, emergency) and the reasoning behind it.
4. **Honest about limits.** Disclaimers are visible but not shouty. Emergency
   guidance is never hidden behind taps.
5. **Private by design.** The prototype stores everything locally in the browser.
   No accounts, no servers.

## 4. Core experience

```
 Welcome ─▶ Profile (age, sex, height/weight, risk factors)
                │
                ▼
          ┌──────────────┐   tap a zone    ┌─────────────────────────────┐
          │  3D Explorer │ ──────────────▶ │ Symptom sheet (4 micro-steps)│
          │ clay ⇄ glass │ ◀────────────── │ what · how much · since when │
          └──────┬───────┘   pin appears   │ · anything else              │
                 │                         └─────────────────────────────┘
                 ▼ "Review"
          ┌──────────────┐
          │   Summary    │  urgency · body map · symptom cards · nudges
          └──────┬───────┘
                 ▼ save
          ┌──────────────┐
          │   History    │  timeline, intensity trend, recurring zones
          └──────────────┘
```

### 4.1 3D Explorer
- A single, seamless, gender-neutral figure (signed-distance sculpted, so no seams)
  in a relaxed A-pose so every zone is easy to tap.
- **Two looks, one toggle:**
  - **Clay**: matte, warm, sculptural, like a ceramic figurine in soft studio light.
  - **Glass**: frosted, refractive, with a luminous rim, a "health-tech" feel.
- 24 tappable zones (head, neck, chest, upper/lower back, abdomen, pelvis, shoulders,
  arms, forearms, hands, thighs, knees, shins, feet). Hovering or tapping lights up the
  zone *on the surface itself* with a soft glow and hairline outline.
- Drag to rotate, with a Front/Back flip button. When a zone is selected, the camera
  eases in on it and the rest of the body gently dims.
- Logged symptoms appear as pulsing pins coloured by intensity.
- "Whole body" entry for general symptoms (fever, fatigue, dizziness…) and red flags.

### 4.2 Symptom sheet
A bottom sheet with four micro-steps. Each can be skipped, and progress is always visible.
1. **What do you feel?** Region-aware chips (e.g. head → headache, dizziness,
   blurred vision; chest → tightness, palpitations, cough).
2. **How strong?** A 0–10 slider with a living face and a colour that warms with
   intensity, plus the *character* of the sensation (sharp, dull, burning, throbbing…).
3. **Since when & how?** Onset (today → months) and pattern (constant, comes & goes,
   with movement, at night).
4. **Anything else?** Optional note and associated red-flag questions.

### 4.3 Summary
- **Urgency card**: one of four levels (Self-care · See a GP · Urgent care · Emergency)
  with the rule(s) that triggered it, written in plain language.
- **Body map** of all logged zones, plus symptom cards.
- **Preventive nudges** based on age, sex and risk factors (blood pressure, cholesterol,
  colorectal/breast/cervical screening, skin checks, vaccines…).
- Save to history, and print or share for your doctor.

### 4.4 History
Timeline of past check-ins, peak-intensity trend line, most frequent zones.

### 4.5 Settings
Profile (age, sex at birth, height, weight → BMI, risk factors), body style
(clay/glass), theme (light/dark/system), reduced motion, clear data. Also shows the
disclaimer and the emergency number.

## 5. Visual & motion language

| Token | Value | Use |
|---|---|---|
| Paper | `#F3EFE9` | Background (light) |
| Ink | `#1C2230` | Text |
| Sage | `#2F6F62` | Primary actions, focus |
| Mint → Amber → Coral | `#7CC4A6 → #F0B35A → #E2674E` | Intensity scale |
| Night | `#0E1217` | Background (dark) |
| Display type | *Instrument Serif* | Headlines, big numbers. Editorial and human |
| UI type | *Manrope* | Everything else. Round and legible |

**Motion:** everything eases *out*, with nothing linear. We use:
- **UI:** spring (stiffness ≈ 380, damping ≈ 34), and `cubic-bezier(.22,1,.36,1)`
  for CSS transitions.
- **Camera:** critically-damped interpolation, so it never overshoots.
- **Sheets:** they rise, and content staggers in 40 ms apart.
- **Idle body:** it breathes very slightly, so the scene never feels frozen.
- **Reduced motion:** honoured throughout.

## 6. Guidance logic (prototype)

Rule-based and deliberately conservative. **This is illustrative and not clinically
validated.**

| Level | Example triggers |
|---|---|
| **Emergency** | Chest pain/tightness ≥ 6 or with breathlessness · sudden one-sided weakness/numbness, facial droop, confusion (stroke signs) · "worst headache of my life" · trouble breathing · fainting |
| **Urgent care** | Any intensity ≥ 8 · severe abdominal pain ≥ 7 · high fever > 39 °C · fever in 65+ |
| **See a GP** | Intensity ≥ 5 · symptoms lasting > 2 weeks · recurring zone across check-ins · unexplained weight loss, lumps, changing moles |
| **Self-care** | Everything else, with tips and "come back if it changes" |

## 7. Out of scope for the prototype
Accounts and sync, clinician portal, real clinical triage engines, localisation,
accessibility audit (though the basics are built in: focus states, labels, contrast,
reduced motion).

## 8. Success signals (for a future pilot)
- ≥ 80 % of first-time users log a symptom without help in < 60 s.
- Clinicians rate the printed summary as "useful" in ≥ 70 % of consultations.
- Uptake of at least one preventive nudge within 3 months.

## 9. Tech
React 19 + TypeScript + Vite, three.js via react-three-fiber/drei, Framer Motion,
Zustand (persisted to localStorage). The body is generated at runtime from a
signed-distance field and meshed with marching cubes. Zone highlighting is done in a
custom shader, so the figure stays one seamless surface.
