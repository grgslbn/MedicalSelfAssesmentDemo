# Soma: a gentle body check-in

An interactive, mobile-first prototype for **preventive medical self-assessment**.
Explore a sculpted 3D body, tap where something feels off, describe it in a few taps,
and get a calm summary with a clear next step, a body map for your doctor, and
preventive check-ups tailored to your age and sex.

> ⚠️ Design prototype. Not a medical device, and the guidance logic is illustrative only.

See **[docs/BRIEF.md](docs/BRIEF.md)** for the product & design brief.

## Run it

```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # static site in dist/
npm run build:single   # one self-contained HTML file in dist-single/
```

## What's inside

| | |
|---|---|
| **3D body** | `src/body/sdf.ts` sculpts a seamless, gender-neutral figure (fingers, face, toes) from signed-distance primitives. `mesher.ts` meshes it with multi-resolution surface nets in a Web Worker: fine patches for the head, hands and feet. `inspect.html` is a dev-only close-up viewer. |
| **Zones** | `src/data/regions.ts` defines 24 tappable zones as capsules. The same maths runs on the CPU (tap → zone) and in the shader (`bodyMaterial.ts`), which paints the glow, outlines and symptom tints directly on the surface. |
| **Clay ⇄ Glass** | A single `MeshPhysicalMaterial` morphs between matte clay and transmissive glass. In glass mode a beating heart and the spine show through. |
| **Low poly** | A third look: a separate coarse, jittered mesh of the same sculpt (`buildLowPolyArrays`), flat-shaded with a fine triangle wireframe. Switching to or from it squashes, flashes and swaps meshes at the midpoint. |
| **Camera** | Critically-damped rig (`Scene.tsx › CameraRig`). It eases to the tapped zone, flips front/back, and shifts the framing so the body stays visible beside the sheet or panel. |
| **Flow** | Onboarding → Explore → Symptom sheet (what · how much · since when · red flags) → Summary → History. |
| **Guidance** | `src/logic/triage.ts` is a conservative rule set with four levels (self-care, GP, urgent care, emergency), and each result shows the reasons behind it. `src/logic/nudges.ts` gives preventive screening reminders. |
| **State** | Zustand, persisted to `localStorage`. Nothing leaves the device. |

Stack: React 19 · TypeScript · Vite · three.js / react-three-fiber / drei · Framer Motion · Zustand.
