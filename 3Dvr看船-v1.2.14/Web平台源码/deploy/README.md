# Three-project entry deployment

## Deployed Status (2026-09-09)

This section supersedes the pre-deployment checklist below.

- Ship Web/live release: `/srv/ship-platform/releases/20260909-final`. Company API user service and production build timer are enabled; last build-service result is success. Physical reboot recovery remains untested.
- Public TCP 8443 is allowed. Desktop and PICO certificate-verified health requests return 200. Login/twin return 200; unauthenticated identity/live APIs return 401. AR 443 remains unchanged.
- Both ship gateways allow 310 MiB uploads. VR downloads proxy the company origin; HTTPS shares the HTTP content cache. All 81 new bundles passed cache/hash verification before their database resource fields were switched.
- Company row rollback file: `backups/final-switch-20260909/vr-model-rows.json`. Fresh full dump: `backups/final-1788969058841/salesboat.dump`. Existing model sources, bundles and prior code releases are retained.
- Certbot timer is active; certificate renewal config includes `renew_hook = systemctl reload nginx`.
- Formal APK installation/production user acceptance and GitHub publication are separate remaining gates. Capacity testing is deferred by the user, not passed. AR shared-database migration is not included.

## Scope

- Keep AR at `https://1.14.77.78/` (443), including `/rtc/` and its existing account/pairing flow.
- Add ship Web HTTPS on 8443. Retain HTTP 80 for existing PICO versions; do not force a redirect before client compatibility tests.
- Serve digital twin from `/srv/ship-twin/current/` at the original `/twin/` URL. Release its static files independently, but retain the same-origin boat/authentication/configuration APIs and boat IDs.
- Keep `/geo-twin`, `/api/vr/screen/`, `/FBX/`, `/uploads/`, and `/vr-content/` contracts unchanged.
- No database migration is included. AR currently uses a local credential configuration and in-memory repair sessions, not the shared PostgreSQL database. A shared-database implementation must preserve expert identity, worker pairing and workflow permissions; do not map them silently onto ship roles.

## Release Gate

`ship-https.conf` is an additive candidate, not an installed production configuration. It depends on the existing `ship_model_cache` declaration in `shipvr.conf` and the existing IP certificate. The certificate is short-lived; verify automatic renewal and Nginx certificate reload before release.

1. Back up current Nginx configuration and record the active ship, twin and AR releases. Never copy credential files into Git.
2. Stage the accepted `twin/` files in `/srv/ship-twin/releases/<release>/`, compare checksums, and point `current` to that version. Keep the previous target for rollback. No new Node service is needed for these static files.
3. Run `sudo node test/https-routing-regression.cjs` on Tencent from this release. It starts a private loopback-only Nginx, uses the real certificate without disabling verification, and shuts the private process down afterwards. It does not reload production or modify database records.
4. Complete authenticated browser tests: login/logout, one-Web-plus-one-PICO sessions, detail -> twin -> detail -> boat management, model upload/preview/publication, and real headset live view. The routing smoke test does not prove these interactions.
5. Check company model-origin completeness and cache recovery separately. This HTTPS addition deliberately retains the existing VR resource location; it is not the cache migration.
6. After the overall release gate passes, install the additive config, run `nginx -t`, then reload Nginx. Allow TCP 8443 in both host and Tencent firewalls. Verify from outside Tencent; loopback success does not prove public reachability.
   The new entry allows 310 MiB request bodies for a 300 MiB GLB plus multipart overhead. The old HTTP entry currently allows only 210 MiB: raise its ship-only limit to 310 MiB in the same release if uploads remain available there. Do not change the AR upload limit.
7. Only after external verification, advertise the HTTPS ship entry and update explicit public base URLs. Retain old PICO URLs. Cookie names remain `ship_session` and `shipar`; HTTPS ship cookies are marked Secure by the proxy. Ports alone are not cookie isolation, so both projects must remain mutually trusted and must not reuse each other's cookie names.

## Trusted Proxy Release Gate

The company API currently runs as a manually started process. Install `ship-platform-api.service` as a user service only during the release window, after staging and backups. Verify user Linger and database readiness first. Stop only the verified old API PID, start the new service, check authentication and health through Tencent, then enable it for subsequent boots. Do not start it while the old process holds port 6060. The system-level `ship-platform-local-deploy.service` points to a different legacy directory; do not enable or overwrite it. On rollback restore the previous API files/env and restart the user service. Test reboot recovery separately; unit verification alone is not reboot acceptance.

Set `TRUSTED_PROXIES` to the exact verified proxy source addresses (comma-separated IPs/CIDRs). Verify the address as observed by the company API, not merely Tencent's public IP or VPN interface: routing/NAT may change it. Never trust all private networks. Nginx must append the actual client address to `X-Forwarded-For`; the API limiter uses Express's validated `req.ip`, not raw request headers. Test distinct clients and spoofed headers through each real entry before release.

## Rollback

Remove only the newly installed HTTPS config and restore the previous twin `current` target, validate Nginx, then reload. Do not remove or replace `ship-ar.conf`, `shipvr.conf`, the certificate renewal setup, RTC routing, company model files, or database records. If public URLs were updated, restore them in the same rollback. This entry change requires no database rollback.
