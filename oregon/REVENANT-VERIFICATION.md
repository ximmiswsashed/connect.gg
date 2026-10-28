# Revenant v21 — October 28, 2026

## Delivered
- Renamed the game and existing Node sidebar entry to Revenant; Oregon URL and lobby protocol remain compatible.
- Black, parchment-white and crimson menus, original heraldic sword crest, self-hosted Grenze Gotisch lettering (Google Fonts, SIL OFL), ruled armory-style panels and modern keyboard-accessible controls.
- Preserved Play, Host Lobby, Join Lobby and collapsible match options; extended theme across selection, equipment, lobby, settings and results. Static ornament; no decorative animation or 3D home scene.
- Fixed narrow-screen map preview collapsing to 2 pixels and Settings controls extending out of their panel. Checked desktop 1280×720 and a real 390px iframe viewport.
- Settings/help/diagnostics stop constructing a character preview. Preview remains available for operator and loadout pages.
- Corrected obsolete manual connection instructions in Diagnostics to describe four-letter lobbies.

## Performance
Chromebook dynamic resolution bounds rendering to a 1280×720 pixel budget, subject to the existing 50% minimum scale. High materials, geometry, effects, collision and simulation are unchanged. Disabling dynamic resolution restores the selected maximum. At a 1920×1080 window this reduces submitted pixels from 2,073,600 to 921,600 (55.6%). UI remains at native CSS resolution. Resolution now descends multiplicatively under sustained overload (up to 20% of scale each second), and recovers slowly; the 240 FPS option remains.

Repeated sound-path calculations are cached in 20cm source/listener cells for at most 80ms, bounded to 128 entries. Destruction revision, world changes and crossing cells invalidate immediately. A stationary 1,000-call fixture reduced world trace requests from 1,000 to 1; its mocked traces are not a real-world CPU/FPS benchmark.

A distance-texture shader experiment did not produce a reliable gain in paired desktop IAB GPU timings and was excluded. `performance-results.json` retains that experiment as diagnostic evidence, not a shipping performance claim. Final photographic shaders match v20.

## Validation
75 menu, audio-cache, adaptive-resolution and shader checks passed. 27 combat regressions passed, including damage, frozen corpses, hidden collision rigs and impact cleanup. TypeScript and Vite production build passed. Desktop and narrow-screen menu/settings inspection completed. Public startup and publication hashes checked separately in the release record.

No physical Chromebook FPS measurement was available. Existing map, destruction, loadouts, multiplayer and zero aiming recoil remain unchanged. Camera and gameplay geometry are unchanged. Existing warnings from historical comparison pages and bundle size remain; only the game entry dependency graph is published.

Editable local source: C:\Users\cruzi\Documents\Codex\2026-10-02\files-pasted-by-the-user-build\outputs\oregon-tactical
Font source: https://github.com/google/fonts/tree/main/ofl/grenzegotisch
