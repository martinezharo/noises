# White / Brown Noise — Noises
===========================
- A small React + Vite project that provides white/brown noise playback utilities and a simple UI to control loops and playback.

Key details
- **Framework:** React with Vite
- **Styles:** Tailwind CSS
- **Audio helpers:** small audio utility in `src/assets/audio/createLoopPlayer.js`
- **Icons:** simple icon components in `src/assets/icons/`

Getting started
1. Install dependencies: `pnpm install` (or `npm install` / `yarn`)
2. Run development server: `pnpm dev`
3. Build for production: `pnpm build`

Project structure (high level)
- `src/` — React source files (`App.jsx`, `main.jsx`, styles)
- `src/assets/audio/` — audio helper(s) and players
- `src/assets/icons/` — small icon components (Play, Pause, Skip, Timer)
- `public/noises/` — bundled audio assets served statically

Notes for contributors
- The project is intentionally small and focused on audio loop playback.
- Keep components simple and prefer small, testable helpers for audio logic.

License
- This project is available under the MIT License (see `LICENSE`).

Made with ❤️ by [Oli](https://olivermartinezharo.com)
