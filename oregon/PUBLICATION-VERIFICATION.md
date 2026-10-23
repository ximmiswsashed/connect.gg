# Breach Protocol publication pass — 23 October 2026

This is a tested playable update, **not a certification that every Oregon prop or Siege mechanic is publication-ready or 1:1**. The supplied Blender layout, map asset packs, menus outside Controls, legal kits, host-authoritative multiplayer, 240 FPS setting and custom destruction rules are preserved.

## Implemented corrections

- Bot locomotion runs every physics update, independently of round-robin sensing. Velocity eases into movement and direction changes with an analytic time-based response. A relative collision-progress threshold replaces the fixed 1 cm threshold that could misclassify normal high-FPS steps as stuck. Footstep distance carries its remainder between steps.
- Bot engagement yaw/pitch and stationary angle changes advance continuously. Bots must face the acquired aim within 0.05 radians in yaw and pitch before firing. Existing varied reaction/acquisition delays, sampled imperfect tracking, uncertain sound clues, finite memory, cover roles and Easy/Normal/Hard settings remain active. Opaque cover and new-target reaction tests pass.
- Fire and Aim/ADS now appear separately in Controls. Keyboard and mouse 0–4 are supported; conflicting actions swap with an accessible status message. Settings persist; Escape cancels capture; Restore Defaults resets bindings. ADS Hold/Toggle is preserved. Menus, capture, blur and pointer-lock loss release combat inputs. Browser context menus are suppressed only for game pointer lock/capture.
- Field guide Fire/ADS/reload prompts follow assigned bindings.
- ADS alignment now reads the dimensions of the actual original sight model, removing dependence on equipment initialization order. This fixes the legacy-versus-rebuilt lens-center mismatch. Gun, sight, reticle and muzzle alignment use the same receiver coordinates.
- Original FMG-9 carry bridge, K1A stock details, C75 foregrip details, jammer carry handle/connector plate and Thermite deployment grip improve silhouettes within existing material batches. No new draw calls from these additions. No imported commercial game models or expensive map detail were added.

## Reference and measured differences

One comparison target is retained throughout: **Siege X Y10S3 Operation High Stakes preview build 93555560**, Beaulo recording published 17 August 2025. Creator-declared settings are 85 degrees vertical FOV and 5:4, stretched to 16:9 output. The matched comparison screenshot uses these settings. The reference map and original weapon housing differ; target distances cannot be equated from these frames.

- [Recorded reference, 14:14](https://www.youtube.com/watch?v=4ONx3X6DgwE&t=854s)
- [Ubisoft Y10S3 notes](https://www.ubisoft.com/en-gb/game/rainbow-six/siege/news-updates/4czc3hlHtXrd27crELGDcc/y10s3-designers-notes)
- [Ubisoft vertical-FOV/ADS sensitivity guide](https://www.ubisoft.com/en-us/game/rainbow-six/siege/news-updates/3IMlDGlaRFgdvQNq3BOSFv/guide-to-ads-sensitivity-in-y5s3)
- Official operator descriptions used for gadget roles/silhouettes: [Ash](https://www.ubisoft.com/en-us/game/rainbow-six/siege/game-info/operators/ash), [Sledge](https://www.ubisoft.com/en-us/game/rainbow-six/siege/game-info/operators/sledge), [Thermite](https://www.ubisoft.com/en-us/game/rainbow-six/siege/game-info/operators/thermite), [Mute](https://www.ubisoft.com/en-us/game/rainbow-six/siege/game-info/operators/mute). Live operator pages are not proof of every historical numerical value.

**Lean:** the existing critically damped reversal is retained, rather than inventing new exact Siege timings. From fully left to right, the continuous curve crosses upright at about 69.9 ms. Frame-sampled crossings are 100/83.3/76.4/70.8 ms at 30/60/144/240 Hz; the difference is sampling, not different underlying motion. It reaches within 0.05 of the right target in about 233–236 ms. Rapid reversals use current position and velocity, not an instantaneous sign flip. Live/replay poses and head/shoulder exposure use the shared transforms. No known-distance/settings-verified reference measurement establishes an exact Siege timing or travel speed; absolute speed, height and lean-distance calibration remain approximate.

**Optics:** 38 supported magnifying/nonmagnifying gun/optic pairs have actual rear-lens centers on the camera axis before equipment preparation, maximum normalized projection error about 1.3e-16. An isolated GPU render changes 20 pixels when the holographic reticle is enabled, confirming visible output. Existing 18-gun/rail, interruption and replay checks also pass.

A nominal 1x has optical magnification 1, separately from ADS camera FOV. The inherited camera factor remains 0.9 of base vertical FOV; at base 85 degrees this gives 76.5 degrees and a fixed target 1.16236 times hip-fire size. This is a measurement of this implementation, **not a verified Y10S3 reference target ratio**. The 2.5x angular calculation gives exactly 2.5 times the 1x target size. Matching independent screenshots for every pair and a reliable same-distance reference hip/ADS pair remain unavailable. The FOV factor and eye-relief profiles therefore remain provisional.

## Structured verification

| Area | Current result | Coverage limits |
|---|---|---|
| Oregon candidate openings | 732 candidates; 2,704 capsule paths pass, standing/crouched/prone, straight/diagonal and both directions | Candidate inventory is not exhaustive; prone footprint, every lean/stance transition and every window vault are separate checks |
| Native breach clearance | Actual source walls, BVH, Game.update movement and reinforcement checks pass | Direct breach calls isolate clearance, not launcher timing |
| Main entrance | 52 checks pass, road/hood/windshield/roof/awning, 18/60/240 Hz, standing/crouched, obstruction retreat and replay-plan transport | Endpoint check permits under 2 cm vertical settling after vault completion, with under 1 mm horizontal error; old micrometer-exact check failed on normal 4.9 mm settling |
| Windows and hatches | Window damage from both sides, cleared layers and six hatch reinforcement/destruction checks pass | Raw legacy audit has 336/338 passes; its two obsolete lean assertions demand 98% reversal within 250 ms. Current smooth curve is 96.53% at 250 ms; no wall/collision failure in those cases |
| Custom hatches | All six native hatch grids fully clear after eligible Ash impact; reinforcement rejects Ash; 14 checks pass | Projectile timing is tested separately |
| Six unique gadgets | 23 authoritative command/action tests pass: travelling Ash round/fuse, hammer windup/impact, interrupted Thermite placement, jammer ignition counter and restoration, held Mute placement/drone disruption, Smoke throw/activation/expiry, Vigil recharge | Exact historical animation/range/damage matching is not certified |
| Legal kits/utilities/models | 158 checks pass, 18 weapons, rail sockets, all legal secondary combinations, utility placement/collision/damage/vision/EMP, replay/live spectator actions | Models remain economical original approximations |
| Motion/firing | 254 regression checks pass; movement, diagonal normalization, fire cadence and zero aiming recoil across 30/60/144/240 Hz | Simulation rates, not real hardware render benchmarks |
| Terrain/obstruction | 12 checks pass, thresholds, stairs, slopes, narrow doors, low ceilings, obstruction and firearm rays | Controlled geometry supplements the actual-map survey |
| Pose/replay | 6 checks pass, hip/partial/full ADS, both leans, firing and repeated interrupted actions | Pixel-identical Siege poses are not claimed |
| Multiplayer round lifecycle | Three actual relay clients: host 120 Hz, guests 30/60 Hz. Two elimination/replay/selection/ready/respawn cycles with bots off, then two with bots on; 15 assertions per run pass | Automated team eliminations drive the full lifecycle; not hours of human combat on different physical devices |
| Main game full-map UI | 8 checks pass: kits, reload circle, elimination replay, live teammate spectator, actual jammer placement hands/progress, no browser errors | In-app browser cannot provide native pointer-lock hardware-input validation |
| Lobby/custom rules | 113 relay checks and 7 localized destruction/penetration checks pass | Public-origin smoke is recorded separately at deployment |
| Controls UI | Keyboard Fire reassignment, conflict swap, middle-mouse ADS capture, persistence, cancel and defaults verified through actual UI | Mouse back/forward dispatch is covered in code/tests, not physical hardware. Requested viewport override did not resize the IAB surface, so the saved mobile attempt remains a desktop capture; phone-width QA is unverified |
| Build | TypeScript and production Vite build pass | Existing chunk-size/font-resolution warnings remain; deployed font assets are reused |

The legacy gadget fixture was corrected to use an authoritative host, an authored eligible surface ID, the actual Ash fuse interval and the production hammer reach. No production destruction rule was loosened to satisfy tests.

## Same-scene performance

Same imported Oregon, same walking/leaning/firing inputs, before/after alternating, three warm runs after warm-up. CPU-only update timing:

| Simulation rate | Before, median total for 2 sec | After | Median p95 update before/after |
|---|---:|---:|---:|
| 60 Hz | 25.0 ms | 25.1 ms | 0.4 / 0.4 ms |
| 240 Hz | 50.0 ms | 47.8 ms | 0.2 / 0.2 ms |

These differences are small and may include timing noise; no hardware FPS gain is claimed. All runs retain **195 map batches, 481 collision batches and 41,470 navigation nodes**.

In the separate controlled nine-bot scene, at 240 Hz bot 0 previously had 319 stationary decision-gap frames out of 359 sampled frames; now zero. Maximum steady movement step decreases from 0.0975 m to 0.01083 m. Its two-second travel is 5.01429 m at every tested rate (30/60/144/240 Hz). The actual Game.update scheduler additionally improves from 172 stationary frames out of 179 sampled at 240 Hz to zero, confirming the movement fix is integrated beyond the direct-module fixture. Continuous movement costs more work: measured two-second bot-update CPU totals at 240 Hz were roughly 6 ms before and 13.2 ms after in that fixture. This trades tiny CPU cost for smoother motion, without increasing sensing frequency.

## Preserved custom rules and remaining work

Zero aim recoil plus visual kick; all-gun holo and attacker-only ACOG; existing skins on weapons/attachments; full clearing of eligible unreinforced hatches by Ash; localized soft-wall breaches; close-range shotgun holes and soft-material penetration remain intact. The supplied Blender layout and map packs were not edited.

No new reproducible blocker was found in the sampled map routes. This pass does not certify every interior/exterior route, every prop/material/decal, every overlapping face, all camera/plant-zone placements, or all gadget timings against the pinned preview. Some legacy numerical tuning predates Y10S3 (including jammer/Smoke/ERC clocks), and one inactive owned Thermite charge at a time remains a prototype limitation. Full manual Oregon visual cleanup, complete route inventory, all-pair reference frames, device-level pointer-lock/mouse-button tests and multi-network human soak testing remain open. Use the included source/fixtures and comparison screenshots for further verification; do not market this as a perfect Siege replica.
