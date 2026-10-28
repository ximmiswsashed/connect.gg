# Revenant v24 — High-quality map rendering, October 28, 2026

Static map instances now receive conservative per-instance frustum tests before GPU submission. Original placement matrices, colors and full batch bounds are retained. No visible model is simplified by this filter; all intersecting boxes are kept with a small safety margin. Stationary view matrices skip both tests and GPU uploads. Changed visibility only uploads the compacted active prefix. Physics, shots, map layout and destruction still use their original structures. This is frustum filtering, not occlusion through walls.

Replay cameras have independent instance buffers and visibility state. A replay created after live culling retains every original placement and can look in a different direction without changing the live scene. Source batch bounds remain fixed, allowing zero-visible-count batches to reappear correctly.

Two additional offline-generated map index detail levels fill the gaps between full geometry and v22's levels. Attribute-aware simplification includes normals, UVs, atlas tile IDs and colors. Their maximum object-space errors are 0.006 m and 0.022 m. Selection still uses the same estimated High 0.75-pixel, Medium 1-pixel and Low 1.4-pixel budgets; close surfaces restore full geometry. These are bounded visual approximations, not lossless geometry or universal pixel guarantees. High textures, materials and effects remain unchanged. The optional 4.74 MB pack downloads after map readiness and v22 detail loading; failures leave the existing detail/full geometry working. Decode yields between batches. No runtime mesh simplifier.

Dynamic resolution now requires four stable samples near the target cadence before increasing by 1.5 percentage points. Overload still reduces resolution immediately at the existing one-second controller sample. This avoids the old pattern of raising resolution every good second and then repeatedly dropping again. The user's selected resolution ceiling and dynamic-resolution toggle are respected.

## Measured map work

Identical High-quality 960x540 desktop IAB views, compared against v23:

| View | v23 triangles | v24 triangles | Reduction | Draw calls |
|---|---:|---:|---:|---:|
| Exterior | 1,645,355 | 1,513,950 | 8.0% | 227 -> 224 |
| Bomb site | 1,476,748 | 1,327,776 | 10.1% | 142 -> 141 |
| Looking away | 362,161 | 332,200 | 8.3% | 29 -> 29 |
| Reverse exterior | 1,560,495 | 1,530,730 | 1.9% | 242 -> 241 |

Visibility filtering alone produced identical pixels in all four measured views. With intermediate geometry levels, mean absolute RGB differences were 0.169/255 exterior, 0 at the site, 0.043/255 looking away and 0.011/255 reverse. These fixed screenshots do not establish universal visual equivalence.

Moving-view visibility tests cost approximately 0.1-0.2 ms on the test desktop. Total CPU submission medians rose approximately 0.1-0.2 ms in three views and were about 0.2 ms higher in the reverse view. This trades modest CPU work for reduced GPU geometry work; it is not a CPU speedup claim. Hardware determines the net FPS result. Actual Chromebook FPS and GPU frame-time gains remain unmeasured. Raw results and source fixtures are in verification/revenant-v24.

## Validation

569 automated checks passed: 132 visibility/LOD/recovery/replay checks, 135 selection and preview regressions, 261 action/map-detail/replay regressions, 27 sustained combat/corpse/impact checks and 14 connected three-client/two-round readiness/respawn checks. TypeScript and production Vite build passed. Existing replay tests cover restoring near geometry and avoiding live-scene mutation. Synthetic cases cover turning, zero-count recovery, changed parent transforms, instance color correspondence and replay construction after culling. Public hashes and smoke verification are recorded in release-record.json.

Editable source: C:/Users/cruzi/Documents/Codex/2026-10-02/files-pasted-by-the-user-build/outputs/oregon-tactical

Source archive retains breach-protocol-source.zip for compatibility. Regenerate the optional pack using tools/build-near-map-lods.mjs with the existing full map assets; the generated binary is deployed separately. Menus, legal loadouts, networking, collision, hitboxes, action timing and zero aiming recoil are preserved.
