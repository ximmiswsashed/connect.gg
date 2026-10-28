# Revenant v22 — October 28, 2026

## Map visibility and performance
Original full map geometry remains available. Two render-only index detail levels, generated offline with meshoptimizer 0.24, reduce distant geometry using an estimated screen-space error budget (High 0.75 pixels, Medium 1, Low 1.4). Full detail returns automatically near surfaces. Atlas, UVs, normals and colors are included in simplification. Collision, hitboxes, map layout, damage masks and destruction eligibility are unchanged. This is a visual approximation at distance, not lossless geometry.

The optional 4.96 MB detail pack downloads after map readiness and is decoded incrementally with event-loop yields. Failure leaves original geometry working. No browser-side simplifier or new per-frame mesh allocation. Main gameplay, spectators, death replay and round replay use the selection; replay copies keep independent detail state. All geometry variants are released on world disposal.

Identical High-quality 960×540 desktop IAB views:

| View | v21 triangles | v22 triangles | Reduction | Draw calls |
|---|---:|---:|---:|---:|
| Exterior | 2,530,036 | 1,645,355 | 35.0% | 227 → 227 |
| Bomb site | 1,851,112 | 1,476,748 | 20.2% | 142 → 142 |
| Looking away | 392,183 | 362,161 | 7.7% | 29 → 29 |

Source full-map triangle inventory remains 2,821,801. Mean absolute RGB byte differences for before/after views were 0.245/255 exterior, 0 at the measured site view, and 0.049/255 away. These are fixed screenshots, not universal visual-error guarantees. Matching captures and raw results are in verification/revenant-v22. GPU queries in this IAB run clustered around the 16.6 ms display cadence, so they do not establish a physical Chromebook FPS gain. Submission CPU medians were essentially unchanged. Actual Chromebook FPS remains unmeasured.

A lossless spatial-batching experiment raised draw calls substantially for small triangle savings and was excluded. Its diagnostic source/results are retained. Existing Chromebook adaptive resolution remains enabled by default and keeps High materials/effects.

## Action presentation
Original cosmetic sequences: planting/defusing with a hinged field terminal, moving keypad hand and progressive indicator; revival with a medical kit; barricade removal with a working cutter; first-person melee lunge; grenade pin-pull hand movement; reinforcement/barricade panel contact motion. Generic field-kit actions are also visible on remote character models. Installation spark/wood-dust beats, throttled battery arcs and SELMA stage puffs use the existing fixed-capacity effect pool. Effects disabled/Low suppress particles. Reloading, ADS, locomotion, weapon switching and specialized gadget animations remain intact; this is not a claim that every existing sequence was replaced. Melee lunge is currently a local first-person embellishment, not a newly replicated remote/replay track.

Animation progress comes from existing action timers. No inventory, cooldown, aiming recoil, fire rate, objective timing or damage changes. Interruptions restore ordinary weapon visibility; death hides first-person tools. No bloom, dynamic effect lights or persistent particle allocations.

## Validation
299 checks passed: 261 detail-index, presentation, interruption, bounded-effect and replay checks; 27 shooting/corpse/impact regressions; 11 damage-region and SELMA checks. TypeScript and production Vite build passed. Published startup and file hashes are recorded separately in release-record.json.

Editable project: C:\Users\cruzi\Documents\Codex\2026-10-02\files-pasted-by-the-user-build\outputs\oregon-tactical
Source archive keeps its existing compatible filename breach-protocol-source.zip. The new generation tool and metadata are included; reuse the deployed binary detail pack or run tools/build-map-lods.mjs against the existing full local map assets. No extracted game animations or models were introduced.
