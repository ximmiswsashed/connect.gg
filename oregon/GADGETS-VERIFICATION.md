# Lean, sensitivity and gadget update — 23 October 2026

## Delivered
- Lean spring response 24 → 14. Full reversal reaches the opposite pose within 0.05 in ~400 ms rather than ~233 ms. At 240 Hz it crosses upright at ~121 ms rather than ~71 ms. The analytic spring preserves position/velocity during interrupted toggles and agrees across simulated 30/60/144/240 Hz. Q/E toggle and wall clearance are retained.
- Independent horizontal/vertical mouse sliders, Standard/Advanced ADS, individual Iron/Holo/Red dot/Reflex/ACOG sliders, numeric readouts, keyboard steps, local persistence and aim-only reset. Values 1–100 for mouse and 1–200 for ADS, half-unit steps. Existing settings migrate without changing angular gain; default legacy ADS .55 becomes 27.5. New reset uses neutral ADS 50. These numbers are game units, not a claim of identical Siege cm/360.
- Reinforcement and barricade presentation now uses original slats, rails, fasteners, a driver tool, phased hand placement, unfold/fasten/recover sequencing, sided world previews and progress-triggered installation sounds. Hatch pose remains supported. Remote characters display the installation kit and solve arms to the animated hands; cancellation removes the kit and restores the firearm. Gameplay completion still uses the existing authoritative timers and obstruction checks.
- Folding four-antenna jammer, case vents, handles/connectors, improved charge hardware/liner-peel and corner-pressure hand motion, canister bands/pin ring, accurate active/EMP-disabled status colors. Fixed charge feedback incorrectly reporting an EMP-disabled jammer as active.
- Rebuilt original shield, barbed wire, camera, claymore, alarm, explosive pack and grenade presentation, merged by material. Active smoke utility hides its grenade hardware and restores it when inactive. No extra lights, textures, network fields, expensive particle systems or gameplay recoil.

## Verification
- TypeScript --noEmit and production Vite build passed.
- Aim-Gadgets-Checks.json: 163 passing checks covering lean timing/reversal continuity, migration and independent gains, disabled jammer feedback, antenna matrices, installation interruption and remote kit visibility, sided preview completion, finite bounds and draw budgets for 11 utility models.
- Operator-Gadgets.json: 23 existing command/action/physics lifecycle checks passed across Ash, Sledge, Thermite, Mute, Smoke and Vigil.
- Kit-Compatibility.json: 158 existing loadout/deployable/optic checks passed.
- Multiplayer-Rounds.json: three actual relay clients at 120/30/60 Hz, bots enabled; 15 checks passed over two team eliminations, round selection/readiness, guest respawn and rejection of stale death snapshots.
- Sensitivity-UI.json: actual main.ts settings UI edited through browser controls; Holo 44, ACOG 68 and vertical 14 survived reload. Advanced/Standard visibility and keyboard/readout update verified. Test preferences restored. No browser console errors or desktop horizontal overflow observed.
- Visual checks: first-person installation, charge and jammer frames, numeric sensitivity layout. Screenshot artifacts accompany this report. Narrow viewport and pointer-lock play feel need manual confirmation in regular Brave; this browser automation does not measure the user's GPU FPS.

## Reference and limits
Reference target retained: Siege X Y10S3 preview build 93555560 / Operation High Stakes, Beaulo gameplay (17 August 2025): https://www.youtube.com/watch?v=4ONx3X6DgwE (creator-declared 85 vertical FOV / 5:4 stretched). The new lean response and procedural animations are original tuning prompted by user feedback, not measured frame-for-frame Siege replicas.
ADS control structure follows Ubisoft's published independent-zoom / screen-motion design: https://www.ubisoft.com/en-us/game/rainbow-six/siege/news-updates/3IMlDGlaRFgdvQNq3BOSFv/guide-to-ads-sensitivity-in-y5s3 . That historical guide supports the design, not exact Y10S3 mouse conversion or animation timings.
Map, menus outside aiming controls, operator kits, action durations, multiplayer protocol, 240 FPS option and custom destruction remain intact. Zero aiming recoil with visual kick remains enabled. No new gadgets or optic magnifications were invented.
