# Operator and gadget release — target Siege X Y10S3.0

This release targets Operation High Stakes at its initial Y10S3.0 rules. Later changes are excluded: Bandit's Keratos arrived in Y10S3.3; Thermite's ITA12S/third charge and Ace's stun replacement arrived in Y10S4. Current operator pages require these historical corrections. This is an original browser implementation, with the custom zero aiming recoil, visual weapon kick, firearm penetration and shotgun destruction preserved.

## Loadouts

| Operator | Primary choices | Secondary choices | Secondary utility choices |
|---|---|---|---|
| Ash | R4-C, G36C | 5.7 USG, M45 MEUSOC | Breach charge, claymore |
| Smoke | M590A1, FMG-9 | P226 Mk 25, SMG-11 | Wire, proximity alarm, shield |
| Sledge | L85A2, M590A1 | P226 Mk 25, Reaper MK2 | Frag, stun, impact EMP |
| Thermite | 556XI, M1014 | 5.7 USG, M45 MEUSOC | Smoke, stun |
| Mute | MP5K, M590A1 | P226 Mk 25, SMG-11 | Bulletproof camera, nitro |
| Vigil | K1A, BOSG.12.2 | SMG-12, C75 Auto | Bulletproof camera, impact |
| Bandit | MP7, M870 | P12 | Wire, nitro |
| Ela | Scorpion EVO 3 A1, FO-12 | RG15 | Wire, shield, impact |
| Ace | AK-12, M1014 | P9 | Breach charge, claymore |
| Twitch | F2, 417, SG-CQB | P9, LFP586 | Smoke, claymore |

Operator pages: [Ash](https://www.ubisoft.com/en-us/game/rainbow-six/siege/game-info/operators/ash), [Smoke](https://www.ubisoft.com/en-us/game/rainbow-six/siege/game-info/operators/smoke), [Sledge](https://www.ubisoft.com/en-us/game/rainbow-six/siege/game-info/operators/sledge), [Thermite](https://www.ubisoft.com/en-us/game/rainbow-six/siege/game-info/operators/thermite), [Mute](https://www.ubisoft.com/en-us/game/rainbow-six/siege/game-info/operators/mute), [Vigil](https://www.ubisoft.com/en-us/game/rainbow-six/siege/game-info/operators/vigil), [Bandit](https://www.ubisoft.com/en-us/game/rainbow-six/siege/game-info/operators/bandit), [Ela](https://www.ubisoft.com/en-us/game/rainbow-six/siege/game-info/operators/ela), [Ace](https://www.ubisoft.com/en-us/game/rainbow-six/siege/game-info/operators/ace), [Twitch](https://www.ubisoft.com/en-us/game/rainbow-six/siege/game-info/operators/twitch).

[Y10S3 notes](https://www.ubisoft.com/en-us/game/rainbow-six/siege/news-updates/4czc3hlHtXrd27crELGDcc/y10s3-designers-notes) support Sledge's Reaper and removal of defender automatic-weapon magnification. [Y10S4 notes](https://www.ubisoft.com/ja-jp/game/rainbow-six/siege/news-updates/1XzWbYPWo59u7NgZVDjaIm/y10s4-designers-notes) establish the later Thermite/Ace changes. Menu and host validate weapon, secondary, utility and optic selections; incompatible saved choices migrate. BOSG retains magnification, automatic defender weapons do not. RG15/Reaper have fixed red dots; ordinary pistols, C75 and SMG-12 use irons. Available optics are a reduced original set rather than every Siege housing. Cosmetic choices remain where compatible.

## Inventory and behavior audit

| Item | Quantity / resource | Implemented behavior and audit result |
|---|---|---|
| Ash launcher | 2 rounds | Equip/fire/reload, swept projectile, surface attachment, delayed soft breach; reinforcement rejects it. Existing custom complete hatch destruction retained. |
| Smoke gas | 3 canisters | Animated release, remote activation, ten-second cloud, obstruction-aware damage and expiry. |
| Sledge hammer | 25 uses | Swing contact commits durability; soft geometry and eligible equipment can be destroyed. |
| Thermite | 2 charges | Held installation/cancel, remote ignition, Mute block, electricity counter, reinforced geometry opening. |
| Mute | 4 jammers | Held floor placement, spherical coverage, drone control/weapon jamming, attached electronic breach inhibition. |
| Vigil | Rechargeable | Observation interference only; ordinary player model stays visible. Existing 12-second/6-second resource cycle retained. |
| Bandit | 4 batteries | Held placement, owner pickup, wall/wire/shield support, EMP disable, touching gadget destruction, static electrical arcs. Timing determines whether a breacher survives. |
| Ela | 3 mines | Adhesive throw, enemy trigger within 4 m with obstruction check, seven-second concussion; nearby allies/owner can be concussed. No removed DBNO extra mine. |
| Ace | 3 SELMAs | Adhesive throw, two staged local wall openings, geometry/collision snapshots at each stage; two devices for reinforced hatch, one for soft hatch; Mute/EMP pause and electricity destruction. |
| Twitch | 2 shock drones + regular prep drone | Camera-relative travel, jump, owned observation switching, three shots per drone, one shot recharged per 30 seconds, 5 HP player laser, first-hit geometry blocking, eligible equipment destruction, Mute and electricity counters. |
| Breach charge | 3 | Soft-surface mount, arming, remote activation, pickup/shooting/EMP/Mute counters, local grid opening, full eligible barricade/soft-hatch removal, directional 50 outward / 150 through-surface maximum. |
| Claymore | 2 | Ground clearance/orientation, three visible clipped lasers, swept enemy crossing, directional obstruction-tested blast, shooting and electronic counters, single authority explosion. |
| Wire | 2 | Ground deployment, enemy slowdown/moving damage, two melee hits, pickup, electrification. |
| Alarm | 2 | Surface deployment, obstruction-aware enemy detection/audio, disable/destruction/pickup. |
| Shield | 1 | Actual ray and movement collision, clearance, recovery, electrification. |
| Frag | 2 | Bouncing projectile, fuse, obstruction-tested explosive damage. |
| Stun | 3 | Bouncing projectile, fuse, visible exposure/facing-based flash. |
| Impact EMP | 2 | Contact activation, radius disable and recovery of electronics. |
| Smoke grenade | 2 | Bouncing projectile/fuse, smoke sight obstruction and expiry. |
| Bulletproof camera | 1 | Surface placement, live team feed, directional resistance, cooldown EMP, disable/destruction/pickup. |
| Nitro | 1 | Throw/attachment, arming, remote blast, destruction and EMP disable. |
| Impact grenade | 2 | Contact blast, local eligible destruction, bounded player damage. |

Rules evidence: [Daybreak electricity](https://www.ubisoft.com/en-gb/game/rainbow-six/siege/news-updates/seasons/daybreak) makes electricity neutral, damages touching gadgets from either team, and slows operators instead of removing HP. Nearby walls do not zap just from proximity; deliberate deployment/vault interaction does. [Y10S2 notes](https://www.ubisoft.com/en-au/game/rainbow-six/siege/news-updates/8dJbwMqIt5Y8lZgwJRjWZ/y10s2-designers-notes) establish Ela's four-metre range. [Y6S3 notes](https://www.ubisoft.com/en-us/game/rainbow-six/siege/news-updates/2zsUnVBdSsc10rirkPl1K5/y6s3-preseason-designers-notes) establish Twitch jumping, five-damage laser and gadget destruction; [Void Edge](https://www.ubisoft.com/en-gb/game/rainbow-six/siege/news-updates/seasons/voidedge) establishes three rechargeable shots. The browser trace is capped at 250 m, exceeding this map's sightlines, rather than mathematically infinite.

[Ace staged-breach change](https://www.ubisoft.com/tr-tr/game/rainbow-six/siege/news-updates/6VV3TGmosIJOUzjegN7eDh/y5s33-tasarmc-notlar) reduces wall stages to two; [hatch rules](https://www.ubisoft.com/en-gb/game/rainbow-six/siege/news-updates/2LqpNY95OdSdWBB8SBEmbg/y5s3-preseason-designers-notes) require two devices on reinforcement. [Burnt Horizon](https://www.ubisoft.com/en-us/game/rainbow-six/siege/news-updates/seasons/burnthorizon) establishes the breach charge's reduced outward-side maximum. The retained 150 through-surface maximum and detailed falloff still need direct season recording validation.

## Evidence limits and remaining inaccuracies

These are working gameplay systems, not a certified numerical replica. The recorded visual evidence inherited from the movement task is [Beaulo's Y10S3 preview](https://www.youtube.com/watch?v=4ONx3X6DgwE), creator-declared 85-degree vertical FOV / 5:4 stretched, frames 854.322 and 859.322 seconds. It is preview footage, not release-season measurements of these new gadgets. No new matching release footage with measured gadget distances/timings was obtained. Accordingly this release does **not** claim exact recorded timing or perfect proportions.

Explicit provisional values: Bandit 2.5 s installation / 0.6 slow multiplier for 0.5 s; Grzmot 1.5 s arming; SELMA 4 s first and 2 s next stage with 1.8 x 1.05 m openings; claymore 1 s arming, 3 m beams, 4 m blast, 160 maximum and linear falloff; Twitch 1 s firing cooldown, movement envelope and original collision silhouette. These values are isolated in `gadget-reference.ts` for later recording calibration and must not be quoted as measured Siege values.

Existing grenade fuses, EMP radius/duration, flash and gas falloff, hammer reach, launcher/breach animation times and fine utility counters remain inherited prototype tuning. This audit checks functioning paths and corrects specific failures; it does not establish all those numbers against Y10S3 footage. Weapon reload times, ammunition reserves (five magazines), spread, some legacy damage/shotgun values and semi-auto input caps are likewise approximate. Reload categories distinguish tube, magazine, break-action and revolver, but original animations do not reproduce every weapon's exact handling. New firearms have individual original silhouettes and rail sockets; hands, operator clothing, sounds and gadgets are stylized, not Ubisoft meshes/audio. Third-person exposure uses the existing shared pose system. No new anti-cheat server was introduced: the trusted lobby host remains simulation authority.

Spatial gadget work runs at 20 Hz with cell queries and swept laser crossing, while projectile motion and animation advance with elapsed time. Electrical arcs rebuild only on surface changes. This bounds frame-dependent work but does not prove 240 FPS on every browser/GPU or real remote-network latency. All clients must refresh together because this release intentionally rejects the old multiplayer protocol.
