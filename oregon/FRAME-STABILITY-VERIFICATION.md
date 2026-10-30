# Revenant v26 — Shared CPU bottlenecks and Chromebook frame stability

October 30, 2026. User reports approximately 30 FPS on High and fluctuating 30–40 on Low, both solo and in lobbies, and requests stable 120 FPS. This release targets shared work and a 120 FPS adaptive budget. Stable 120 on the physical Chromebook has not been demonstrated or guaranteed.

## CPU and allocation changes

* Capsule queries now reject triangles whose bounds cannot touch the query before expensive closest-point work. Flat queries reject non-intersecting triangles first. Destruction-hole/clearance queries run only after an actual capsule/box contact. Contact points, radii, normal thresholds and hole rules are unchanged.
* Five cardinal floor-support rays share one BVH traversal. The centre and all four existing support points remain; no new disc support, rounded positions or approximate physics. Individual scalar queries remain available. Queries still check destroyed surfaces and the same vertical range.
* Bounded, fixed-storage caches tag exact coordinates, elevation and step height. Hash collisions only cause misses. Surface revisions, reset and new registered panels invalidate the relevant data. No unbounded key-string growth.
* Character pose evaluation updates only the necessary parent chain while solving the pose and performs one final full model transform walk, replacing three full walks. Final world matrices, including hitboxes, agree with the prior implementation across 48 mixed stance/lean/ADS/reload/reinforcement poses.
* Session cross-player lists and callbacks are reused while membership, device references and drone references are unchanged. New/removal/replacement of equipment, shock drones, players, impact callbacks and actor objects invalidates the links. Object state changes remain live through the retained references. Session stop/start clears cached links. Packet formats and send rates are unchanged.

## Rendering and target cadence

The Chromebook adaptive target increases from at most 60 to at most 120 FPS, constrained by the user's selected cap and the browser callback refresh estimate. Uncapped mode can target 120. This does not force a 60 Hz browser/display to deliver 120 callbacks. Diagnostics and F8 captures now include browser refresh estimate and adaptive target; the capture also measures combined support-query work.

An optional 2.96 MB far-index pack adds attribute-aware detail levels with maximum object-space simplification errors of 0.08 and 0.16 m. They are selected only in Chromebook mode and only when they fit the existing estimated 1.5-pixel High/Medium or 2-pixel Low budget. Close surfaces and optic zoom retain the existing detail selection. Desktop mode ignores these levels. This is a distance-dependent visual approximation, not a lossless or universal pixel guarantee. Original collision and destruction geometry remain unchanged.

The new pack loads after map readiness and the existing optional v22/v24 packs, only when Chromebook mode is enabled, including enabling it later in Settings. Decode yields between batches. Failure leaves existing geometry/detail working. No browser-side simplifier. High/Low lighting and texture settings are otherwise those of v25.

## Matched measurements

Uninstrumented hot paths, seeded three-second Oregon run with local forward movement and nine bots, 180 rendered-pose steps and 360 simulation steps. Direct route goals remove worker scheduling variance. This CPU-only desktop comparison is not physical Chromebook FPS.

| Metric | v25 | v26 | Change |
|---|---:|---:|---:|
| Total simulation CPU | 423.5 ms | 279.3 ms | -34.0% |
| Simulation median per frame | 2.1 ms | 1.4 ms | -33.3% |
| Simulation p95 per frame | 3.8 ms | 2.3 ms | -39.5% |
| Total character presentation CPU | 111.1 ms | 79.0 ms | -28.9% |

Final local/bot positions matched exactly. A separate instrumented call-count run reduced hole checks from 526,113 to 77,092 (-85.3%). Scalar ground calls fell from 60,474 to 23,014 plus 7,492 combined support calls. Instrumented timing includes wrapper overhead and is not used for the timing table above.

A representative pose performs 126 recursive matrix updates rather than 378. A ten-player, 120-refresh roster fixture replaces the root external-device array zero times rather than 120 times. The latter checks actual session refresh code with synthetic actors; measured refresh CPU was about 2.1 ms before and 0.2 ms after on this desktop.

Same-resolution, same-camera Chromebook-mode rendering (High 960x540, Low 832x468):

| Quality / view | v25 triangles | v26 triangles | Reduction | Draw calls |
|---|---:|---:|---:|---:|
| High exterior | 1,442,429 | 1,257,304 | 12.8% | 224 -> 224 |
| High site | 1,197,647 | 1,122,028 | 6.3% | 141 -> 141 |
| High away | 294,943 | 293,803 | 0.4% | 29 -> 29 |
| Low exterior | 1,435,838 | 1,194,136 | 16.8% | 224 -> 224 |
| Low site | 1,183,502 | 1,075,629 | 9.1% | 141 -> 141 |
| Low away | 288,352 | 280,894 | 2.6% | 29 -> 29 |

Disabling Chromebook mode restored the measured desktop view to 1,543,492 triangles and its original Phong map material. No measured physical Chromebook GPU times, FPS or thermal results are claimed. These changes do not establish a fourfold FPS gain or a stable 120 FPS result on arbitrary hardware.

## Validation

848 automated assertions passed: 217 exact-cache/pose/far-index checks, 5 support checks covering 1,608 scalar-versus-bundled comparisons, 2 capsule checks covering 1,800 old/new comparisons before and after destruction, 15 session-link checks, 14 connected three-client/two-round checks, and 595 prior profile/visibility/selection/presentation/combat/SELMA assertions. TypeScript and the production Vite build passed. The connected run used actual local WebRTC data channels with manual signaling; it does not verify availability of the public four-letter relay service. It covered eliminated guests, readiness, respawn, stale death snapshots and post-respawn movement. No new home relay service was launched.

Raw results, fixtures, the frozen v25 baseline and the offline generation tool are included in the source package. Public file hashes and smoke results are recorded separately in release-record.json.

Editable source: C:/Users/cruzi/Documents/Codex/2026-10-02/files-pasted-by-the-user-build/outputs/oregon-tactical

Source download retains breach-protocol-source.zip. Regenerate the new binary with tools/build-map-far-lods.mjs using the existing full local map assets; the deployed binary is separate from the source archive. Menus, legal loadouts, recoil customization, map layout and networking protocol are preserved.
