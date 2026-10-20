# Four-letter Breach Protocol lobbies

The game is served from `/connect.gg/oregon/` on GitHub Pages. Its room service runs on the home PC. The browser that creates a room remains the gameplay host.

## Prepared change

- Create lobby generates four uppercase letters. Friends type them into Join Lobby; no invite/response exchange.
- Both players see callsigns, teams, connected status and player count.
- Ordered WebSocket transport passes inputs, snapshots, destruction and replay packets through the home PC, avoiding direct WebRTC/NAT setup.
- Invalid, missing, full, started and incompatible rooms have actionable errors. Departed guests disappear; they can rejoin before the match. Closing the host expires the code. Automatic mid-match resume is not implemented.
- Dead connections have heartbeat/timeout detection and bounded send queues. The host must keep the page and service running.

## Home PC setup

1. Install dependencies in `breach-lobby-server` with `pnpm install` (or `npm install`). The downloadable delivery also includes the installed `ws` dependency.
2. Run `Start Lobby Service.cmd` on the home PC.
3. Add an isolated path to the existing Tailscale Funnel: `tailscale funnel --bg --set-path=/breach http://127.0.0.1:5311`. Preserve the existing root and8443 routes. Verify `/breach/health` and the WebSocket connection before publishing the game index.
4. Upload/merge the included `oregon` changes into the existing repository. Existing asset-loader, asset-packs, map packs and all other website features remain in place.

Endpoint: `wss://mhm.tail8dfc7f.ts.net/breach/lobby`, configured in `oregon/lobby-config.json`. The service allows the exact GitHub Pages origin and the existing home HTTPS origin. It listens on loopback; no router or firewall rule is added.

Public activation was completed on October 20, 2026 after the user started the service on the home PC. HTTPS health and four-letter hosting/joining passed through the actual public Funnel route with the GitHub Pages Origin. The root and8443 routes remain intact. Keep the home service and host page open while playing. Connectivity from the school's network remains unverified.

## Validation

Run `pnpm test` in this folder for room lifecycle, routing and concurrency checks. Client TypeScript, two-player UI and native three-round results are supplied with the delivery verification report. `client-source` contains the changed client files for review; the full editable game project remains the original local checkout.
