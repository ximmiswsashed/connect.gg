# Expanded operator release verification

Target: Siege X Y10S3.0. See [loadout table, sources and remaining inaccuracies](https://ximmiswsashed.github.io/connect.gg/oregon/OPERATOR-REFERENCE.md). Original TypeScript/Three.js implementation. Existing map, menu flow, multiplayer, custom firearm/shotgun destruction, cosmetics and zero aiming recoil are preserved.

## Delivered

Bandit, Ela, Ace and Twitch are selectable, with individual weapons, legal secondaries/utilities, original character/gadget models, hand poses, deployment animations and spatial audio. Twelve missing firearms have individual silhouettes and rail sockets. Loadout migration and host validation reject ineligible weapons, utility and optics. New device state has stable UUIDs; host simulation controls inventory, damage, attached stages, pickup and destruction. All new fields/resources reset with rounds. The protocol version prevents old clients from joining the new simulation.

Bandit counters devices only after installation commits; Y10S3 electricity slows operators without HP damage and destroys touching electronics from either team. Ace opens local grid geometry at each stage and needs two SELMAs for reinforced hatches. Ela uses enemy-only detection with obstruction and an area concussion that can affect allies. Twitch owns two independently resourced jumping shock drones, with camera-relative movement, selected-drone input, recharge, jamming and first-hit laser collision. Claymores use actual clipped beam segments, swept crossing, directional damage and one authoritative explosion.

The full unique-gadget/utility inventory is documented in OPERATOR-REFERENCE.md. Audit corrections include Mute blocking ordinary remote breach charges, local directional charge breaches, supported battery placement on shields/wire, valid disabled-state handling, camera-relative shock aiming replication, shield target visibility, avoiding empty projectile geometry, and safe lookup of an absent surface index.

## Executed checks

| Suite | Passing checks | Scope |
|---|---:|---|
| Interaction-Checks.json | 80 | All ten operator restrictions/migration; placement interruption; electricity, friendly electronics and no HP zap; wire/shield support; Ace stages/hatches/Mute; Ela obstruction/concussion; Twitch shot/recharge/jam/cover/jump; claymore actual HP, clipped beams, swept crossing and duplicate guard; ordinary charge Mute/directional damage; spatial culling/IDs |
| Connected-Operators.json | 16 | Six actual WebSocket relay clients at 30/60/120 Hz; host validation; Bandit versus ignited Thermite and SELMA, battery pickup, Ace geometry snapshots, Twitch two-drone selection/aim/ammo/destruction, Mute, Ela affected-client state, claymore one-explosion damage/blocked beams |
| Kit-Audit.json | 234 | 29 legal weapon models and legal sockets, finite hands/poses, all ten operators' secondary firing/reloading, every utility's functional path, personal killcam and live spectator |
| Legacy-Gadgets.json | 23 | Ash launcher projectile/breach, Sledge swing/durability, Thermite held placement/Mute/reinforcement, Mute drone inhibition/recovery, Smoke throw/activation/expiry, Vigil recharge |
| Connected-Respawns.json | 15 | Three relay clients plus bot teams; two actual team eliminations, next-round selection/readiness, respawn at 100 HP, rejection of stale prior death snapshots, responsive movement |
| Presentation-Checks.json | 15 | Twelve new first-person firearms use 7–14 draws in the isolated gallery; shock drone 9; interrupted Ela/Ace throw restores firearm |

TypeScript noEmit and production Vite build passed. Main menu shows all ten badges loaded, Twitch's three primary/two secondary choices, side restrictions and no horizontal overflow at the tested desktop viewport. Original gallery and menu captures accompany the local delivery.

## Performance and network limits

New proximity work is scheduled at 20 Hz with spatial cell lookup, not all gadgets against all actors each rendered frame. Laser crossing sweeps between samples. Static electrical meshes update on geometry revision; gadget/drone geometry is batched and introduces no dynamic lights. Existing packed map/equipment loading stays in place; unchanged large asset packs are reused by the website patch.

Connected checks use multiple real clients on the local relay, not two physical machines over the internet. The public home relay returned HTTP 502 at release checking. Publishing static files cannot start the home relay; cross-network play still requires that service. No new 240 FPS claim was measured in the in-app browser. Frame rates above are simulation update rates, not GPU benchmarks.

## Remaining inaccuracies

Read OPERATOR-REFERENCE.md before treating numeric values as Siege measurements. Stage, arming, blast falloff, animation, reload/reserve and some legacy tuning remain explicitly provisional. No fresh release-season recorded timing measurements were obtained; inherited preview footage is visual context only. Models/audio are original stylized versions, not exact commercial assets. Full Siege gadget interaction parity and every optic housing are not claimed.

Controls: G unique gadget; hold G for battery placement; F pickup; B remote unique activation; 4 utility; 5 utility remote activation; V observation, Q/E cycle, N exit. Twitch fires with the normal fire input while controlling an owned shock drone and jumps with Space.

Everyone must refresh after publication to use the same protocol. The working Brave GPU launcher remains applicable for the reported software-renderer issue.
