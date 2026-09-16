# Noises

Noises is a small React/Vite player for bundled brown and white noise. It
decodes the local audio assets with the Web Audio API and keeps playback looping
in the browser.

## Features

- Play, pause, resume, and skip between brown and white noise.
- Brown noise uses a searched crossfade loop boundary; white noise uses native
  audio-buffer looping.
- A countdown timer starts at five minutes, changes in five-minute steps,
  supports pause/resume, and stops playback when it reaches zero.
- Keyboard controls use the arrow keys, Enter, and Escape.
- Installable as a PWA and fully usable offline: the service worker precaches
  the app shell and both audio files, so nothing is fetched at runtime.
- A Capacitor Android project is included alongside the web app.

Audio files live in [`public/noises`](public/noises); the loop player is in
[`src/audio/createLoopPlayer.js`](src/audio/createLoopPlayer.js).

## Development

Requires pnpm and Node.js 20.19+ or 22.12+ for the web toolchain. Use Node.js
22.12+ for the Capacitor scripts.

```bash
pnpm install
pnpm dev       # Vite development server
pnpm lint      # ESLint
pnpm build     # production build
pnpm preview   # build and run the Wrangler preview
pnpm deploy    # build and deploy with Wrangler
pnpm sync      # build and sync the Capacitor Android project
```

## PWA

The web app is a PWA. [`vite-plugin-pwa`](https://vite-pwa-org.netlify.app/)
generates the web app manifest and a Workbox service worker during `pnpm build`;
both are configured in [`vite.config.js`](vite.config.js).

- The precache covers the shell plus `public/noises`, so the precache budget is
  raised above Workbox's 2 MiB default to fit the ~5.5 MB brown noise sample.
- Updates use `autoUpdate`: a new deploy takes over on the next visit.
  [`public/_headers`](public/_headers) keeps `sw.js`, `index.html`, and the
  manifest revalidating so that deploy is actually seen.
- Registration lives in
  [`src/registerServiceWorker.js`](src/registerServiceWorker.js) and is skipped
  inside the Capacitor shell, which already ships the assets on-device.
- Icons in [`public/icons`](public/icons) are generated from
  [`public/favicon.png`](public/favicon.png); the maskable variants pad the mark
  into the 80% safe zone.

Cloudflare/Vite integration is configured in [`vite.config.js`](vite.config.js)
and [`wrangler.jsonc`](wrangler.jsonc). See [LICENSE](LICENSE) for the license
terms.
