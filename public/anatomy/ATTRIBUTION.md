# Anatomy data attribution

BodyParts3D, © The Database Center for Life Science (DBCLS), licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

- Dataset: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/
- Publication: Mitsuhashi et al. (2009), *BodyParts3D: 3D structure database for anatomical concepts*. https://doi.org/10.1093/nar/gkn613
- Obtained via the browser-ready package in https://github.com/ashemag/human-atlas (BodyParts3D 4.0; app code MIT).

**Adaptations for Soma:** a curated subset of bones, major organs and major superficial
muscles; geometry simplified with meshoptimizer and quantized; warped (height remapping plus
per-height scaling) to fit Soma's gender-neutral figure; hands rotated to Soma's pose; left/right
copies grouped under plain-language names. The dataset has no lung or main liver surfaces, so the
lungs and liver are **approximate envelopes** generated around the bronchial tree and hepatic
vessels. BodyParts3D is an adult male reference. This is not a diagnostic tool.

Rebuild with `npm run anatomy:extract -- <path-to-human-atlas>/public/models`.
