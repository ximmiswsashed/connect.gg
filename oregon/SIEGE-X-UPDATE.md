# Siege X gameplay and interface update — October 21, 2026

This update belongs to the existing `oregon/` game embedded in connect.gg. The site shell, sidebar integration, map packs, four-letter lobby service, public endpoint and 240 FPS setting remain in use.

## Changes

- Match options retain expanded state, focus and scrolling across rule changes.
- Round results reject old-round packets and hide outside the result/replay phases. Offline play now chooses a legal operator and kit before the first round and every subsequent round, including side changes.
- Lean collision clamps head clearance while keeping the requested Q/E direction. A blocked trial no longer repeatedly damps lean toward center. Low-obstacle movement tries a bounded step with body and head clearance; full-height walls remain solid.
- The defuser overhead HUD marker appears only for a dropped case viewed by attackers. Friendly overhead markers contain one operator badge. Team HUD badges use the bot's actual operator.
- All firearms offer holographic sights and all eleven existing painted finishes. Attackers also have ACOG; defender readiness validation and the runtime optic getter prevent defender magnification. Sights have per-weapon mounts. Weapon and attachment coatings use the same cached patterns as the existing R4-C, excluding glass and reticles.
- Firing has zero ballistic recoil and retains viewmodel shake. Tracers use one fixed 32-segment pool. Body, head, upper/lower limb hit volumes follow the actual modeled dimensions; hats, masks, packs and weapons do not gain hit volumes. Rifle head hits are lethal at supported health values; shotgun pellets use a range-adjusted 1.5 modifier rather than rifle instant kills.
- Ash clears complete eligible unreinforced hatches. Reinforced hatches retain reinforcement immunity. Close shotgun shots cut medium local holes with a bounded destruction budget. Barricade raycasts use the same two-sided lattice as collision rather than the visual seams between boards.
- Reinforcing walls and hatches has staged metal-strip previews; barricading has staged board placement. First-person installation has present/unfold/fasten/recover poses. Completion and cancellation remain authoritative gameplay actions.
- Aspect ratios: 16:9 default, 4:3, 5:4 and 3:2. The chosen projection stretches into the existing canvas, consistently for the world and sights; HUD coordinates remain tied to the displayed canvas.
- Menu composition follows Ubisoft's Siege X reference: top navigation, central actual operator model and side panels. Click operator emblems to select a kit. The game keeps its own title and available functions.

## Reference provenance and limits

Official operator badges were downloaded from each operator's Ubisoft page on October 21, 2026, in roster order: Ash, Smoke, Sledge, Thermite, Mute, Vigil. Original PNGs are in `public/operator-icons/`.

- Current menu: [Ubisoft roadmap](https://www.ubisoft.com/en-us/game/rainbow-six/siege/news-updates/roadmap), released New Menu UI entry; its `Menus-HUB-Main-S2_THUMBNAIL.jpg` is the visual reference. The browser game uses its own modeled character and omits unrelated progression/shop features.
- [Ash operator page](https://www.ubisoft.com/en-us/game/rainbow-six/siege/game-info/operators/ash): ranged soft breaching and non-reinforced surfaces.
- [Ubisoft hitbox refactor](https://www.ubisoft.com/en-us/game/rainbow-six/siege/news-updates/6M8aa7Obw7bVa2zqwsNC0T/operation-health-diagnosis-hitbox-refactor): historical body-only hitbox principle.
- [Y8S3 designer notes](https://www.ubisoft.com/en-us/game/rainbow-six/siege/news-updates/2Btj0mP7e7gVKIODGSLuiX): dated official shotgun head modifier reference. This is historical evidence, not a new current-season timing measurement.

Zero recoil and all-weapon cosmetic/optic access are the user's custom rules. Exact current Siege X lean timing and one-to-one map metrology are not established by these sources. The existing source map's scale/layout is retained; its approximately two-metre window/door openings and 1.82-metre player envelope are checked for traversal. Tests establish finite behavior and regressions, not perfect hitboxes, complete Siege parity or guaranteed internet latency.

## Verification

Native production-class suite: 338/338 checks, including both directions for 21 exterior windows, all six hatch covers, every firearm's holo/ACOG mount and paint, six operators in stance/lean combinations, zero aim drift, small-obstacle traversal, full-wall blocking and wall-contact lean at 18/60/240 FPS.

Pure destruction/penetration checks and the 113-check lobby room-service suite pass. UI round selection, HUD visibility, responsive layout, two rendered connected clients, and deployed-file verification are recorded separately in the delivery reports. Read those reports for their exact run results and limits.
