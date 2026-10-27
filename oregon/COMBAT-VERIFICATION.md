# Combat, effects and gadget corrections (v20)

## Shooting frame spikes
The player-fire path recursively raycast full character hierarchies, including two skinned meshes per actor, hidden equipment, and cosmetic geometry for every pellet. The nine-target benchmark recorded 252 skinned raycasts for 14 rifle shots and 2,016 for 14 shotgun shots.

Player fire now queries cached dedicated head/torso/arm/leg hitboxes. Actor/equipment matrices and the target list are prepared once per shot, shared across pellets. The same benchmark recorded zero cosmetic/skinned raycasts. Damage and headshot classification remain active.

| Weapon | v19 median CPU ms/shot | v20 median CPU ms/shot | v19 p95 | v20 p95 |
|---|---:|---:|---:|---:|
| R4-C | 29.7 | 0.3 | 30.6 | 0.5 |
| M590A1 | 237.5 | 0.4 | 240.3 | 0.7 |
| SMG-12 | 29.8 | 0.2 | 30.3 | 0.3 |

These are desktop in-app-browser CPU timings, with identical nine-target layouts, two warmup shots and twelve measured shots per case. They are not total game frame times or physical Chromebook FPS. Pellet randomness is retained, so shotgun damage-event counts differ slightly. The previous cheaper map shaders, Chromebook defaults and dynamic resolution remain.

## Ghost bodies and dead actors
The local player collision rig was explicitly made invisible when created, then CharacterRig.update made it visible again. Bot targeting could therefore create a rendered local body at the camera/player position. It now stays hidden after every collision-pose update; existing human visibility is preserved. Offline collision geometry is prepared at round start instead of first incoming fire.

Dead character poses are frozen on death, stop running IK/animation, and disappear after three seconds. Moving the actor input after death cannot move the corpse. Living respawns restore pose updates and visibility. Downed actors remain living actors.

## Bullet holes and effect cost
Marks now retain the impacted surface. Broken/hidden barricades remove their marks, and grid edits recheck mark footprints so decals cannot hang in a newly opened wall hole. Character, drone and gadget hits do not create persistent world-space bullet holes. New rounds and menu transitions clear transient effects.

Particles upload color only when spawned, upload positions/sizes only while active, and stop drawing/uploading while idle. Both marks and particles retain fixed-size storage.

## SELMA
Real-map soft-wall throws worked in both the frozen and corrected build. The original diagnostic also included two blocked underside-hatch launches; those are retained as diagnostic failures, not advertised as successful detonation tests. Valid checks cover five walls from both faces and two top-down hatches, both soft and reinforced: all 24 cases passed. Reinforced hatches retain the existing two-device rule.

- Logical surface contact resolution now tolerates a small collision/volume boundary discrepancy, selecting the closest intact logical volume within 35 mm rather than requiring exact floating-point containment.
- An unrecognized/unbreachable contact previously consumed the fuse/device silently. It now produces the detonation effect/sound and surface feedback without bypassing destruction restrictions.
- Mute/EMP suppression still pauses the fuse. Suppressed devices signal amber, the jam state is replicated, and the owner receives fuse-paused/resumed feedback. Removing the jammer resumes the countdown.
- A deployed device continues ticking when its owner dies.

## Sidebar cache correction
The host site fetched fresh game HTML to validate it, then opened the ordinary iframe URL, which could reuse cached HTML. It now extracts the validated entry-bundle name and adds it to the iframe URL. The root page references the revised launcher script. Two launcher tests verify successive builds launch with different build URLs. Other site features are unchanged.

## Validation
- TypeScript and production build passed.
- 27 combat/corpse/effect checks with sustained-shot CPU comparisons.
- 11 damage-region, suppression/resume, visible detonation and owner-death fuse checks.
- 12 valid soft-wall/hatch throws and 12 reinforced-wall/hatch throws on the actual Oregon map.
- 234 kit/optic/utility checks, 16 six-client gadget checks, and 18 connected multi-round spawn/respawn checks.
- Two host-launcher cache tests. Total: 332 passing checks/cases.

All clients need the combat-v20 build to share a lobby. The source archive contains the frozen v19 baseline and verification fixtures. Actual Chromebook FPS still needs measurement on that device.
