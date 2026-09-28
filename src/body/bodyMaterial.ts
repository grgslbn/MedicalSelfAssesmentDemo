import { Color, MeshPhysicalMaterial, Vector3, Vector4 } from 'three'
import { REGIONS } from '../data/regions'

const N = REGIONS.length

export interface BodyUniforms {
  uA: { value: Vector3[] }
  uB: { value: Vector3[] }
  uR: { value: number[] }
  uSide: { value: number[] }
  uGlow: { value: number[] }       // 0..1 hover/selection glow per zone
  uTint: { value: Vector3[] }      // logged-symptom colour per zone
  uTintAmt: { value: number[] }    // 0..1
  uFocus: { value: number }        // 0..1 how much non-selected zones dim
  uFocusIdx: { value: number }
  uAccent: { value: Color }
  uRim: { value: Color }
  uRimAmt: { value: number }
  uTime: { value: number }
  uGlass: { value: number }
  /** V0.2 anatomy window: centre (local space) + radius; radius 0 = closed */
  uWin: { value: Vector4 }
  /** V0.2 X-ray: 0 = solid skin, 1 = see-through */
  uXray: { value: number }
}

export function createBodyMaterial() {
  const mat = new MeshPhysicalMaterial({
    color: new Color('#e9ddd0'),
    roughness: 0.62,
    metalness: 0,
    sheen: 0.6,
    sheenRoughness: 0.8,
    sheenColor: new Color('#fff1e6'),
    clearcoat: 0.08,
    clearcoatRoughness: 0.6,
    ior: 1.22,
    thickness: 0.16,
    attenuationDistance: 0.8,
    attenuationColor: new Color('#b9d3ff'),
    iridescenceIOR: 1.4,
    iridescenceThicknessRange: [180, 520],
  })

  const uniforms: BodyUniforms = {
    uA: { value: REGIONS.map((r) => new Vector3(...r.a)) },
    uB: { value: REGIONS.map((r) => new Vector3(...r.b)) },
    uR: { value: REGIONS.map((r) => r.r) },
    uSide: { value: REGIONS.map((r) => (r.side === 'front' ? 1 : r.side === 'back' ? -1 : 0)) },
    uGlow: { value: new Array(N).fill(0) },
    uTint: { value: REGIONS.map(() => new Vector3(1, 0.5, 0.4)) },
    uTintAmt: { value: new Array(N).fill(0) },
    uFocus: { value: 0 },
    uFocusIdx: { value: -1 },
    uAccent: { value: new Color('#3f9c89') },
    uRim: { value: new Color('#ffffff') },
    uRimAmt: { value: 0.25 },
    uTime: { value: 0 },
    uGlass: { value: 0 },
    uWin: { value: new Vector4(0, 0, 0, 0) },
    uXray: { value: 0 },
  }

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLocal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocal = position;')

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        #define NREG ${N}
        varying vec3 vLocal;
        uniform vec3 uA[NREG]; uniform vec3 uB[NREG]; uniform float uR[NREG]; uniform float uSide[NREG];
        uniform float uGlow[NREG]; uniform vec3 uTint[NREG]; uniform float uTintAmt[NREG];
        uniform float uFocus; uniform float uFocusIdx; uniform vec3 uAccent; uniform vec3 uRim;
        uniform float uRimAmt; uniform float uTime; uniform float uGlass;
        uniform vec4 uWin; uniform float uXray;

        float segD(vec3 p, vec3 a, vec3 b, float r) {
          vec3 pa = p - a, ba = b - a;
          float l2 = dot(ba, ba);
          float h = l2 > 0.0 ? clamp(dot(pa, ba) / l2, 0.0, 1.0) : 0.0;
          return length(pa - ba * h) - r;
        }
        // nearest and second-nearest zone → index + edge distance
        void zoneOf(vec3 p, out int idx, out float edge) {
          float d1 = 1e5; float d2 = 1e5; idx = 0;
          for (int i = 0; i < NREG; i++) {
            float s = uSide[i];
            if (s > 0.5 && p.z < 0.0) continue;
            if (s < -0.5 && p.z >= 0.0) continue;
            float d = segD(p, uA[i], uB[i], uR[i]);
            if (d < d1) { d2 = d1; d1 = d; idx = i; } else if (d < d2) { d2 = d; }
          }
          edge = d2 - d1;
          // front/back seam on the torso
          if (abs(uSide[idx]) > 0.5) edge = min(edge, abs(p.z) * 1.4);
        }`,
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        // V0.2: cut a window through the skin to reveal the anatomy underneath
        float winD = uWin.w > 0.0 ? length(vLocal - uWin.xyz) - uWin.w : 1.0;
        if (winD < 0.0) discard;
        float winRim = uWin.w > 0.0 ? 1.0 - smoothstep(0.0, 0.007, winD) : 0.0;
        int zIdx; float zEdge;
        zoneOf(vLocal, zIdx, zEdge);
        float zGlow = uGlow[zIdx];
        float zTint = uTintAmt[zIdx];
        float isFocus = float(zIdx) == uFocusIdx ? 1.0 : 0.0;
        // logged symptoms warm the surface
        float breathe = 0.85 + 0.15 * sin(uTime * 2.2);
        diffuseColor.rgb = mix(diffuseColor.rgb, uTint[zIdx], zTint * 0.55 * breathe);
        // dim everything except the focused zone
        diffuseColor.rgb *= 1.0 - uFocus * (1.0 - isFocus) * 0.32;
        diffuseColor.rgb = mix(diffuseColor.rgb, mix(diffuseColor.rgb, uAccent, 0.55), zGlow * (1.0 - uGlass * 0.5));
        // the inside wall of the cut reads as a soft, darker shell
        if (!gl_FrontFacing) diffuseColor.rgb *= vec3(0.62, 0.5, 0.46);
        diffuseColor.a *= 1.0 - uXray * 0.82;`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `#include <emissivemap_fragment>
        vec3 vdir = normalize(vViewPosition);
        float fres = pow(1.0 - clamp(abs(dot(normal, vdir)), 0.0, 1.0), 2.6);
        float line = 1.0 - smoothstep(0.0015, 0.0055, zEdge);
        float pulse = 0.75 + 0.25 * sin(uTime * 3.0);
        totalEmissiveRadiance += uAccent * zGlow * (0.18 + 0.22 * fres) * pulse;
        totalEmissiveRadiance += uAccent * line * zGlow * 0.9;
        totalEmissiveRadiance += uTint[zIdx] * zTint * (0.10 + 0.35 * fres) * breathe;
        totalEmissiveRadiance += uRim * fres * uRimAmt * (1.0 - uFocus * (1.0 - isFocus) * 0.6);
        totalEmissiveRadiance += uAccent * winRim * 1.4;
        totalEmissiveRadiance += uRim * fres * uXray * 0.5;`,
      )
  }
  mat.customProgramCacheKey = () => 'soma-body'

  return { mat, uniforms }
}
