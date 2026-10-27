# Realistic visual overhaul — 27 October 2026

This update replaces the simplified rendering direction across weapons, operators, gadgets and the map's surfaces. It preserves the Oregon layout, collision, hitboxes, loadouts, authority, round flow and custom destruction. Zero aiming recoil remains; firing effects and weapon kick are cosmetic.

## Implemented changes

- All 29 selectable firearms receive physically lit material response, photographed surface relief, machined receiver details, ejection ports, pins, rail screws, sling mounts, muzzle collars and magazine details. Existing cosmetic paints remain usable. Expanded operator weapons gain shaped receivers, ergonomic grips, contoured stocks and continuous curved magazines; procedural box components use inward bevels. Existing rail and muzzle coordinates remain the aiming authority.
- All ten operator rigs use lit cloth instead of an unlit vertex-color material, tailored elliptical garment volumes, folds, vest webbing and pouch seams, zipper detail, curved headgear/face covers and rounded eyewear. Articulated skeletons and invisible hitboxes remain in the existing shared pose system. The enemy outline glow is removed. GPU skinning still combines clothing/gear in one body mesh.
- Unique devices and secondary utility gain beveled housings, vents, fasteners and physically shaded metal/polymer. Status-light material references remain live. Drones use denser wheel/hub silhouettes with the existing wheel articulation. Installation tools, hammer, launcher and objective equipment also receive the material/edge treatment.
- Oregon's simplified unlit atlas is replaced by physical lighting with metric world-space photographed plaster/wood detail and normal relief. The original atlas masks, markings and sectional cutout code remain. Twenty-five eligible box components gain inward chamfers through a 20,311-byte compressed patch; collision files are unchanged. Most static map topology is retained rather than redrawn or rescaled.
- Added filmic tone mapping and a generated reflection environment for equipment. There is no new real-time shadow-map, ray-tracing or screen-space reflection pass.
- Replaced the solid muzzle cone with a soft combustion flare. A fixed pool supplies material-specific impact dust, wood-toned particles, hot metal/electrical sparks, muzzle haze, breach/SELMA bursts and burning-charge emissions. Impact scars use a 64-slot pool and particles a 384-slot pool. Audio event deduplication also gates replicated visual events. Smoke gas uses noise-based billowing; utility smoke gets collision-fitted puffs instead of a faceted sphere. Effects do not change authoritative damage or sight-blocking rules.
- High is the requested default with effects enabled and the existing 240 FPS cap. An existing Low choice is preserved during the one-time settings migration. Low omits photographic shader sampling and extra impact effects; dynamic resolution remains available. High-Low-High recompiles instanced map variants correctly.

## Verification actually performed

| Check | Result |
|---|---|
| TypeScript noEmit + production Vite build | Passed |
| Matching-camera model/material comparison | 49 checks pass: finite detailed firearms, draw/triangle budgets, operator/device rendering, fixed effect storage, map geometry budget and no shader compilation errors |
| Legal weapon, optic socket, secondary, utility and replay regression | 234 checks pass |
| Gadget interaction regression | 80 checks pass |
| Six real local WebSocket clients, mixed 30/60/120 Hz simulation | 16 checks pass, including electrical counters, Ace geometry, two shock drones, Mute, Ela and one authoritative claymore explosion |
| Three real clients plus bot teams, two eliminations and next rounds | 15 checks pass, including alive guest respawns, stale-death rejection and responsive movement |
| High-Low-High map rendering | No shader errors at 960x540; 45 measured renders per tier after warmup |
| Main game UI | High, 100% maximum resolution and 240 cap present; no captured console errors at startup |
| Design detector | No findings in changed game-render targets |

The overview comparison uses identical cameras and lights. Visible map draws stay 139; visible triangles rise from 1,782,577 to 1,920,273 (7.72%) because some beveled templates are instanced. Unique static geometry rises by only 800 triangles. A different stationary 960x540 camera measured 227 map draws / 2,530,036 triangles; CPU submission median was 0.6 ms High, 0.5 ms Low, 0.5 ms High after switching back, and p95 0.9/0.7/0.7 ms. These are **CPU submission measurements**, not GPU timings, whole-game FPS or a promise of 240 FPS on the home PC. No physical two-computer internet performance test was performed.

The compact photographic JPEG set is 1,600,183 bytes. Color images retain 1K resolution; normal/roughness maps are prepared at 512px. Map/equipment packs are reused. No multi-megabyte replacement of the full map is required. The offline bevel generator also produced full batches for validation, but those are excluded from publication; only the compressed patch ships.

## References and provenance

The visual direction follows the tactical clarity, material detail and lighting described by [Ubisoft's Siege roadmap](https://www.ubisoft.com/en-us/game/rainbow-six/siege/news-updates/roadmap) and [Ubisoft Toronto's map-modernization discussion](https://toronto.ubisoft.com/behind-the-wall-modernizing-maps-in-rainbow-six-siege-x/). This is an original implementation, not extracted Siege models or effects. Existing gameplay remains targeted to Y10S3.0 as documented in OPERATOR-REFERENCE.md.

Photographed material sources: Poly Haven [denim fabric](https://polyhaven.com/a/denim_fabric), [brown leather](https://polyhaven.com/a/brown_leather), [metal plate](https://polyhaven.com/a/metal_plate), [grey plaster](https://polyhaven.com/a/grey_plaster), [oak wood planks](https://polyhaven.com/a/oak_wood_planks). These assets are CC0 under [Poly Haven's asset license](https://polyhaven.com/license). Original download URLs and preparation channels are retained in assets/realism-v17/provenance.json. Albedo modulation is normalized using the source photographs' linear-light averages, retaining original operator and cosmetic colors.

## Remaining limits

The result is more detailed original browser art, not AAA photorealism or a 1:1 Siege asset recreation. Characters still use the original rigid articulated skeleton; facial likeness, skin scattering, simulated cloth and facial animation are not reproduced. Many underlying map meshes retain their original reconstructed forms. Material classification is an approximation over the existing map atlas, not a hand-authored PBR set for every surface. Particles are bounded approximations; they do not reproduce every Siege effect or provide dynamic debris collision. Real-time shadows, volumetric lighting, motion blur and expensive post-processing are deliberately absent. Existing gameplay-reference timing/loadout limitations are unchanged.

The public home lobby relay returned HTTP 502 during checking. Local connected tests pass, but cross-network play still requires that existing service; this visual deployment does not restart it.
