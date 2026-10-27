# Gadget, model and Chromebook refinement (v18)

Updated the existing game without changing the map layout, menus, legal loadouts, zero-aim-recoil customization or destruction rules.

## Performance
- Replaced whole-map physical shading with a cheaper lit Phong path. Low uses an unlit atlas path while retaining the original sectional destruction shader.
- Medium uses photographic albedo only; High retains photographic normal/roughness details on equipment. ChromeOS migrates the old forced High setting to Medium once and enables dynamic resolution. Existing Low settings stay Low; users can subsequently select High.
- Distant/non-High player clothing uses reduced accessory geometry. In the measured Ela rig, submitted body vertices/indices fell from 89,808 to 41,424, retaining the skeleton and hitboxes.
- Held operator devices are constructed when used instead of allocating all three on every player.

Same-camera, 960x540 GPU timer queries in the desktop in-app browser, 35 valid GPU samples per row:

| Quality | v17 median GPU ms | v18 median GPU ms |
|---|---:|---:|
| High | 2.499 | 0.427 |
| Medium | 2.739 | 0.266 |
| Low | 2.906 | 0.224 |

These are stationary map render timings, not total game frame times or measurements on the user's Chromebook. Geometry and draw count were identical (2,530,036 triangles; 227 draws), isolating shader cost. Actual Chromebook FPS remains to be confirmed there.

## Gadgets and presentation
- Secondary utility now has a draw, windup/place, release and recovery gesture, in first and third person. Inventory is committed once at release. Sprinting, dying, switching and invalid placement cancel correctly.
- Twitch shock-drone deployment uses the same animated release path; authority still owns inventory and deployment.
- Sticky SELMA/Grzmot attachment uses the exact swept contact and logical surface, avoiding the old secondary-ray reconstruction that could select an adjacent panel. Mount offsets derive from device depth.
- Rebuilt Bandit's battery with lid, terminals, handle and cables; rebuilt Ela's mine as a perforated cylindrical canister with collar, display and adhesive heel; SELMA has hinged opening plates driven by replicated stage timing, without scaling the entire mount.
- Differentiated frag, stun, smoke and EMP housings. Weapon handguards now have open vent apertures in eligible authored profiles. Corrected BOSG to over-under barrels, P226 slide/hammer/decocker, and the LFP586 cylinder axis. Existing optic sockets remain in place.
- Reduced duplicate oversized facial eyewear, adjusted nose/mouth details and corrected gadget wrist targets.
- Dead bodies disappear after three seconds, stop pose work, and become visible again on respawn. Downed players remain visible. Network pose synchronization no longer advances the death timer a second time or revives expired body visibility.

## Validation
- TypeScript check and production Vite build passed.
- 65 focused gadget/body/model checks, including 30/60/240 Hz body timing and actual network mesh synchronization.
- 80 operator interaction checks and 234 kit/optic checks passed.
- 16 six-client connected gadget checks passed: Bandit counters, SELMA stages/destruction replication, mine concussion, shock deployment/fire/jamming, claymore authority and utility propagation.
- 15 three-player/three-round respawn checks passed with bots enabled.
- No shader errors in map or equipment checks.

## References and limits
Pinned gameplay rules remain Siege X Y10S3.0; cosmetic presentation timings and dimensions are authored approximations. This release improves specific silhouettes and functioning animations, not an exact AAA asset replacement of every mesh. The custom Reaper is intentionally original. No extracted Ubisoft geometry or animation was used.

Reference silhouettes: [Ubisoft Ela](https://www.ubisoft.com/en-us/game/rainbow-six/siege/game-info/operators/ela), [Bandit](https://www.ubisoft.com/en-us/game/rainbow-six/siege/game-info/operators/bandit), [Ace](https://www.ubisoft.com/en-us/game/rainbow-six/siege/game-info/operators/ace), and [official MP7 product page](https://www.heckler-koch.com/en/Products/Military%20and%20Law%20Enforcement/Submachine%20guns/MP7). These inform shapes, not unverified exact animation timing.

All lobby participants must reload the website to use the new compatible gadget protocol. Public home relay availability is separate from these local connected-client checks.
