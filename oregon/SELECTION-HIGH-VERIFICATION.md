# Revenant v23 — October 28, 2026

## Operator selection and loadout
Siege-style Locations / Operators / Loadout / Ready progression, side-only icon roster, selected operator portrait, gadget description, primary/secondary/gadget slot cards, weapon stats and category pickers. Original weapon model previews show the actual mounted optic and selected weapon/attachment finish. Legal kits and role-specific optics remain based on the existing Siege X Y10S3.0 gameplay configuration. Invalid default sights now fall back to a legal sight, including iron-only pistols. Confirm loadout only appears on the loadout step. Settings returns to the correct selection step. Enemy operator identities remain hidden during the team-ready countdown.

The tactical selection palette and condensed typography are scoped to preparation; Revenant's medieval red/black/white home menu remains. Full 5v5 ready lineup fits 1280x720. At 390px the interface stacks and scrolls without horizontal overflow. Buttons retain keyboard activation and selected-state labels.

Official Ubisoft promotional operator portraits are used with source URLs and SHA-256 hashes in assets/revenant-v23/operators/provenance.json. Reference: https://www.ubisoft.com/en-us/game/rainbow-six/siege/game-info/operators/ash and Ubisoft's published attacker-repick UI article https://www.ubisoft.com/en-us/game/rainbow-six/siege/news-updates/SmrKAxySvKiUvd06lTOyl/y6s4-whats-new-on-the-lab-test-server . The older article establishes layout vocabulary, not current mechanical values. This is a reconstruction adapted to the implemented roster; exact pixel parity with a matching-version full reference capture has not been established. In-game weapon/character models and animations remain original code.

## High-quality performance
High resolution limits, materials, effects and v22 map detail budgets are unchanged. Three sources of unnecessary work were removed:

* Unchanged combat HUD content retains DOM nodes; only FPS text updates independently. Timer, ammo, health and other state changes still rebuild the HUD.
* Hidden first-person weapons skip model and cosmetic obstruction work during observation/death and restore when returning.
* Stationary cosmetic near-cover probes are limited to 20 Hz and invalidated immediately by motion, direction or destruction changes. Actual firing obstruction/collision traces are unchanged.

Menu previews render once on demand and reuse a bounded 24-entry image cache; operator portraits are static images. Selecting a different optic/finish generates the correct new image. No continuously rendered menu character scene.

Desktop CPU microbenchmarks (not complete-frame or Chromebook FPS measurements): 500 repeated HUD updates took 101.9 ms before and 0.2 ms after; 120 hidden High viewmodel updates took 5.1 ms before and timer-rounded 0 ms after, with cosmetic traces reduced from 242 to zero. Stationary probe fixture made 20 traces in 120 samples at 120 Hz. Hardware, timer resolution and workload affect these measurements; they do not establish a device FPS gain. Existing adaptive resolution and map LOD remain active.

## Validation
448 automated checks passed: 135 selection/legal equipment/cache/CPU checks, 261 presentation/map-detail/replay regressions, 27 combat/corpse/impact checks, 11 hit-region/SELMA checks, and 14 actual connected three-client/two-round readiness/respawn checks. TypeScript and production build passed. Manual selection -> spawn -> operator -> loadout -> ready -> preparation, returning from Settings, valid secondary sights, attachment finishes, 1280x720 and 390px layouts verified. Full-team ready fixture confirms enemy identities remain hidden. Public deployment hashes/startup are recorded separately in release-record.json.

Editable project: C:\Users\cruzi\Documents\Codex\2026-10-02\files-pasted-by-the-user-build\outputs\oregon-tactical
Source archive retains the compatible filename breach-protocol-source.zip. Physical Chromebook FPS remains unmeasured. This release preserves gameplay timing, zero aiming recoil, map, destruction, loadouts and networking contracts.
