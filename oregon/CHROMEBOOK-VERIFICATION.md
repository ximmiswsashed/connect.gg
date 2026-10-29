# Revenant v25 — Chromebook performance, October 29, 2026

## Changes

Chromebook performance mode defaults on for ChromeOS when no saved preference exists, remains off by default on desktop, and can be changed under Settings -> Display. The choice persists. It changes presentation rather than authoritative simulation:

* Static map lighting uses a cached vertex-lit Lambert material in Medium/High, retaining the atlas, vertex colors, alpha cutouts and original sectional-destruction shader callback. It omits the map's Phong specular and High micro-normal sample. Low retains its existing unlit map path. Disabling restores the original map material. Cached variants are reused and disposed with the world.
* Map distance-detail error budgets become 1.5 estimated pixels for Medium/High and 2 for Low. Desktop budgets remain unchanged (High 0.75, Medium 1, Low 1.4). Near surfaces restore full geometry. Reuses the existing v22/v24 optional index packs; no new map asset download. This is a visual approximation, not lossless geometry.
* With dynamic resolution enabled, the Chromebook pixel ceiling is approximately 960x540, scaled for display aspect, subject to the user's selected resolution ceiling and a 25% scale floor. UI remains at CSS/display resolution. Dynamic resolution off respects manual resolution. Its optimization target is at most 60 FPS; the user's actual frame cap remains unchanged, including 240/uncapped.
* Adaptive overload checks use approximately half-second windows and retain the four-second sustained-headroom recovery rule. Paused/menu/selection/background samples and stalls over 250 ms reset the controller rather than causing a background-driven resolution drop.

Weapon and character High materials, weapon optics, effects toggle, collision, hitboxes, movement, firing, destruction rules and networking remain unchanged. This mode deliberately trades softer resolution, simpler map highlights/relief and more aggressive distance geometry for less GPU work.

Tracer visualization now evaluates muzzle pose/obstruction and tracer rays only for newly observed shot serials. Previously the muzzle getter was evaluated eagerly for every player every frame, even while idle or viewing observation tools. First sight of a player, serial resets, hidden observation/menu shots and repeated serials do not generate phantom tracers. Existing single-shot segment, cover trace and fade behavior are retained. No damage or firing traces were removed. This optimization applies on all devices.

## Measurements

A deterministic ten-player, 120-frame idle tracer fixture performed 1,200 muzzle evaluations before and zero after. New local and remote shots each performed one muzzle evaluation and one visual tracer trace. This is a call-count result, not a whole-game FPS benchmark.

Fixed desktop IAB High-quality camera views comparing the old Chromebook 1280x720 ceiling against the new mode:

| View | v24 triangles, 1280x720 | v25 mode, same resolution | v25 mode, 960x540 | Triangle reduction at new ceiling |
|---|---:|---:|---:|---:|
| Exterior | 1,543,492 | 1,469,198 | 1,442,429 | 6.5% |
| Bomb site | 1,372,066 | 1,253,200 | 1,197,647 | 12.7% |
| Looking away | 351,640 | 326,621 | 294,943 | 16.1% |

Pixels at the ceiling decrease from 921,600 to 518,400 (43.75%). Draw calls remain 224/141/29. Desktop CPU submission medians were approximately 0.4/0.3/0.2 ms at the new ceiling; these small timer-quantized measurements do not establish a GPU-time or hardware FPS gain. Disabling the mode restored the exterior's original 1,543,492 triangles and Phong material. Raw rows and representative images are in verification/revenant-v25 and the output folder.

Actual Chromebook FPS, p95 frame time and thermal behavior remain unmeasured. The reductions above concern rendering workload and redundant calculations, not guaranteed FPS multipliers. No claims of a pixel-identical image: map lighting, resolution and distant geometry intentionally differ in this mode.

## Validation

595 automated checks passed: 29 Chromebook controller/material/tracer checks, 132 visibility/LOD/replay checks, 135 selection/cache checks, 261 presentation/map-detail/replay checks, 27 combat/corpse/impact checks and 11 hit-region/SELMA checks. The regression wrappers enabled Chromebook mode before running their fixtures. TypeScript and production Vite build passed. Actual UI toggle, 960x540 canvas size at 1280x720 viewport, and preference persistence across reload were verified. Shader compilation passed for all measured map views. The ten-player tracer fixture includes new shots, unchanged serials, observation, menu and round resets.

Networking code and protocol are unchanged; no new connected-player relay run is claimed for this release. Live deployment hashes and browser startup checks are recorded separately in release-record.json.

Editable source: C:/Users/cruzi/Documents/Codex/2026-10-02/files-pasted-by-the-user-build/outputs/oregon-tactical

Source archive retains breach-protocol-source.zip for compatibility. The existing map/detail assets remain cached and unchanged.
