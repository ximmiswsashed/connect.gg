# Spawn spacing and fitted weapon models (v19)

## Spawn correction
Both bots and remote players now reserve their final, collision-resolved spawn position. Each standing actor gets at least 1.10 m of horizontal centre spacing on the same floor. The search validates static collision and floor height, and checks positions after recovery so several actors cannot be moved back onto one fallback point.

Removed the multiplayer offset derived from the first character of a player ID. Human and bot reservations share the host's occupied positions. Selected attacker spawn and defender site remain in use, including subsequent rounds.

73 actual-Oregon checks passed: all three attacker spawns, all four sites, both player sides with full bot teams, ten humans with identical ID prefixes, mixed humans/bots, collision clearance and next-round resets. Minimum observed centre spacing was 1.10 m. An additional three-client relay test verifies replicated teammate separation on initial deployment and two subsequent rounds.

## Weapon reconstruction
Reauthored the 24 catalog/operator models (IDs 6–29) with weapon-specific receivers, stocks, furniture, grips, magazines and controls. Retained the existing six core authored bodies, removing their misplaced generic detail overlay. Factory receivers now use a smooth coating, with separate molded polymer and machined metal response, instead of a conspicuous plate-like photographic pattern.

Concrete corrections include:
- G36C open carry bridge and triangular stock; FMG-9 grip-fed magazine and folding rear housing.
- Bullpup L85/F2 magazine placement; supported F2 carry handle and connected folded bipod.
- MP7 grip-fed magazine, folding front grip and stock rods; curved Scorpion/AK magazines; individual 417 receiver/handguard.
- Conventional versus pistol-grip shotgun furniture, stockless ITA12S, and over-under BOSG barrels.
- Distinct handgun frames, slides, exposed controls and revolver cylinder; removal of large generic rails on iron-only handguns.
- Real open muzzle bores. Barrel endpoints agree with the aiming/obstruction socket. Corrected the FMG-9 and Reaper muzzle sockets to their rebuilt barrel positions.
- Per-weapon hand/wrist and magazine contact points. Pump ribs travel with the pump, batched into one draw. ITA12S uses its pump presentation.

Removed the universal decorative pass that placed extra sight posts, ribs, pins and handles at the same coordinates regardless of the receiver underneath them. Optics retain shared world/viewmodel/replay sockets. Pistol iron heights and the Reaper optic mount now match their modeled supports.

## Verification
- TypeScript and production Vite build passed.
- 202 all-weapon checks passed: finite geometry, bounded render cost, muzzle agreement, supported rails, finite contact poses, and every legal optic seat. No shader errors.
- 234 existing kit, optic, first-person/remote hand and utility checks passed.
- 73 real-map spawn checks passed.
- 18 connected-client spawn/respawn and stale-snapshot checks passed at different update rates.
- Four front-facing muzzle ray checks also passed: the metal lip is visible and the bore centre remains open. Total: 531 passing checks. Isolated weapon renders stayed within 7 draws and 9,036 triangles, including the retained core models.

The previous Chromebook shader fixes and scalable presets remain. Map layout, menus, legal loadouts, damage/fire-rate profiles and zero aiming recoil are retained.

## Reference and remaining limits
Original geometry was guided by the official loadout silhouettes on Ubisoft's [Ash](https://www.ubisoft.com/en-us/game/rainbow-six/siege/game-info/operators/ash), [Smoke](https://www.ubisoft.com/en-us/game/rainbow-six/siege/game-info/operators/smoke), [Sledge](https://www.ubisoft.com/en-us/game/rainbow-six/siege/game-info/operators/sledge), [Thermite](https://www.ubisoft.com/en-us/game/rainbow-six/siege/game-info/operators/thermite), [Mute](https://www.ubisoft.com/en-us/game/rainbow-six/siege/game-info/operators/mute), [Vigil](https://www.ubisoft.com/en-us/game/rainbow-six/siege/game-info/operators/vigil), [Bandit](https://www.ubisoft.com/en-us/game/rainbow-six/siege/game-info/operators/bandit), [Ela](https://www.ubisoft.com/en-us/game/rainbow-six/siege/game-info/operators/ela), [Ace](https://www.ubisoft.com/en-us/game/rainbow-six/siege/game-info/operators/ace), and [Twitch](https://www.ubisoft.com/en-us/game/rainbow-six/siege/game-info/operators/twitch) pages. These images support structural/silhouette corrections; they do not establish exact three-dimensional cross sections, mechanical dimensions, engravings, animation or camera calibration. Existing season-pinned gameplay rules remain separate from current illustration references. Models and hand animation remain authored approximations, not scanned or extracted Siege assets.

Comparison images auto-fit each model for readability; they are not physical-scale measurement plates. All lobby participants must reload for the fitted-v19 build compatibility identifier.
