# On-device debugging — G2 glasses IMU

The G2 glasses have **no browser and no JS engine of their own**. Your web code runs inside the WebView of the Even Realities phone app, and drives the glasses over Bluetooth through the SDK bridge.

## The standard dev loop

Open 3 terminals and **keep all three running**.

### Terminal A — dev server

```bash
cd /Users/jay/workspace/evenpet
npm run dev
```

Vite starts on `http://localhost:5173`.

### Terminal B — Cloudflare tunnel

```bash
cloudflared tunnel --url http://localhost:5173
```

It prints:
```
Your quick Tunnel has been created!
https://xxx-yyy-zzz.trycloudflare.com
```

> **Why the tunnel?** When tethering off an iPhone hotspot, your Mac often gets a `192.0.0.2/32` point-to-point address. The phone itself goes to the internet over cellular and cannot reach that IP. On a regular Wi-Fi network you can skip this step and just point the phone at your computer's LAN IP.

### Terminal C — generate a QR for the tunnel URL

```bash
# small image (normal scan)
npx --no-install evenhub qr -u https://xxx-yyy-zzz.trycloudflare.com/imu-debug.html

# big image (use if the small one won't scan)
npx --no-install evenhub qr -u https://xxx-yyy-zzz.trycloudflare.com/imu-debug.html -e -s 10
```

Replace `xxx-yyy-zzz.trycloudflare.com` with the actual domain from terminal B.

## Scan with the Even App

1. Open the **Even Realities App** on your phone.
2. Go to **Developer mode** / **Developer** (bottom of the "Me"/"Settings" tab).
3. Tap **Scan**.
4. Scan the QR from the terminal.

> ⚠️ **You must use the developer-mode scanner.** If you scan with the system camera, Safari, or WeChat, the URL opens in the system browser, **the SDK bridge is never injected**, `getDeviceInfo` returns null, and every device API fails.

## Verification

Once the WebView has loaded, the event log on `/imu-debug.html` should show:

```
Bridge connected
getDeviceInfo → { "model": ..., "status": { "connectType": ..., "batteryLevel": ... } }
Device state: wearing=true battery=... connection=...
```

Tap **Start IMU** to begin streaming. The CSV is uploaded automatically to `./imu-logs/<session>.csv` on the computer.

## One-time setup (already done)

- `brew install cloudflared` (install once per Mac)
- `vite.config.ts` sets `server.allowedHosts: true` (otherwise Vite blocks external domains)
- `vite-imu-log-plugin.ts` prints the LAN URL + a local QR at startup, and exposes `/api/imu-log` to collect phone-side samples into `./imu-logs/`

## Known gotchas (cross-reference when stuck)

| Symptom | Cause | Fix |
|---|---|---|
| Scan completes but the page is blank / times out | Wi-Fi client isolation, or iPhone hotspot `/32` point-to-point address | Use the cloudflared tunnel |
| `Blocked request. This host is not allowed.` after loading | Vite default only allows localhost | `vite.config.ts` → `server.allowedHosts: true` |
| Page loads but `getDeviceInfo` returns null, every SDK call fails | Scanned with the system browser / camera | Scan with Even App's developer-mode scanner |
| `createStartUpPageContainer` returns 1 (invalid) | Bad container parameters (e.g. too small) | Copy the known-good config from `src/app/g2-ui.ts` |
| Scan finishes and the phone spins forever | localhost.run / loca.lt inserts an interstitial page the Even WebView can't get past | Switch to cloudflared |
| QR stops working after changing Wi-Fi or restarting dev server | Tunnel URL / LAN IP changed | Re-run terminals B and C |

## IMU data spec (measured in Phase 0)

- **x, y, z = acceleration in g units** (at rest |v| ≈ 1)
- **`P100` is actually ≈ 10 Hz** (P200–P1000 untested, presumably scale up by N×)
- At rest σ ≈ 0.2; a 30° head-down tilt moves z from 1.0 to ~0.87 — signal-to-noise ≈ 5×, posture detection is feasible
- **No timestamps in the payload** — the JS side stamps with `performance.now()`
- **No gyroscope, no Euler angles** — only three-axis accelerometer
