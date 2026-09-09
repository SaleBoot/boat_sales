# Deployment Boundary

Code can be replaced often. Assets and database records must survive releases.

Persistent asset directories:

- Tencent: `/srv/ship-platform/shared/public/assets`, `/srv/ship-platform/shared/FBX`, `/srv/ship-platform/shared/uploads`, `/srv/shipvr-content`
- Company origin: `/home/cqypxl/ship-platform-api-6060/shared/public/assets`, `/home/cqypxl/ship-platform-api-6060/shared/FBX`, `/home/cqypxl/ship-platform-api-6060/shared/uploads`, `/home/cqypxl/ship-platform-api-6060/shared/vr-content`

The matching paths under `current/` are symlinks. Do not replace them with real directories during deployment.

Use explicit code-only copies preserving relative paths for updates. The legacy `scripts/safe-deploy-web.sh` needs review before reuse; it flattens public paths and omits vendor dependencies. Never sync persistent asset directories with deletion enabled.

## VR Live Screen

Successful detail-page VR sync opens `/vr-screen.html`. Deploy that page, `public/js/vr-screen.js`, and `public/vendor/livekit-client.umd.js` together; update the detail script cache version.

Tencent runs `ship-vr-screen.service` on loopback port 3001 using `src/vr-screen-server.js` and `src/vr-screen.js`. Nginx routes `/api/vr/screen/` there, ahead of `/api/`, which remains on the company origin. Screen authentication forwards cookies/Bearer tokens to the company `/api/auth/me`; do not use Tencent's old database for session checks. LiveKit media stays on Tencent's existing `ship-ar-rtc.service`, with secrets in `/etc/ship-platform-rtc.env`. Never copy secrets into releases or source control.

Install locked dependencies before restarting the screen service. Keep its service unit in `deploy/ship-vr-screen.service` and preserve the Nginx screen route on future deployments. The screen service has no persistent database or model writes. Backups for this restoration are under `backups/vr-screen-restore-20260909` on both hosts.

Regression checks: `node test/vr-sync-screen.test.js`, `node test/vr-screen.test.js`, `node test/vr-screen-client.test.js`, and `node test/vr-screen-origin.test.js`. A loaded page or detected headset does not prove actual video playback; verify with an awake PICO logged into the same account.

## Single-Ship GIS Twin

`/twin/?boat=<shipId>` loads the same catalog record, configuration and model as the detail page. `/geo-twin/` redirects here. CesiumJS 1.120.0 is bundled in `public/vendor/cesium`; retain its license and third-party notices. The Three.js water normal image is from the r160 examples (MIT).

Online imagery, place labels and elevation come from Esri World Imagery, World Boundaries and Places, and WorldElevation3D Terrain3D services. They require network access; availability and source resolution limit the result. This release does not include photogrammetric port buildings or offline map coverage.

Boat positions and playback tracks are simulations unless a valid `twinConfig.position` is provided. Port-view ship models use a minimum screen size for visibility. Sea-level coloring is a visual approximation, not a surveyed coastline or navigation chart. Do not claim reference-image-identical fidelity.

Before a restore, create a PostgreSQL 16 backup with the matching container tools. The fleet81 restore was checked as 27 boats, 81 variants, and 81 published VR models, with SHA256 equality between batch, Web and VR copies. Code backups for this change are under `backups/twin-gis-20260909` on both hosts.
