# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Gesture Spellbook (repo: gesture-spells): turn hand gestures in front of a camera, such as drawing a rune in the air or a spell-casting motion, into animations and sound over video. It runs in the browser; README.md describes the modes, tabs and plans in full.

Two workflows share one library of animations and audio:

- **Spellbook mode (live):** make spells (gesture + animation + audio), then record video while the app recognises the gestures and plays their effects.
- **Editing mode (after the fact):** record video first, then select stretches on a timeline and apply animations and audio to that stretch or to every similar gesture.

Animation Builder and Audio Lab are placeholder modes for later.

## Commands

- `npm install` (also runs `npm run setup`, which copies the MediaPipe WASM runtime to `public/mediapipe/` and downloads the hand model to `public/models/`; both are git-ignored)
- `npm run dev` serves at http://localhost:5173. The port is fixed because IndexedDB data is per origin.
- `npm run lint`, `npm run build`

## Stack and layout

React 19, Vite, react-router-dom, plain JavaScript (no TypeScript). Hand tracking is `@mediapipe/tasks-vision` (Hand Landmarker, VIDEO mode, GPU delegate), with files served locally from `public/`. Target browsers: Edge (the owner's browser) and Chrome.

- `src/modes/` defines each mode's tabs. `src/components/ModeShell.jsx` turns them into nested routes (`/spellbook/audio`) and the bottom tab bar.
- `src/components/Workspace.jsx` is the shared layout: list 1/3 on the left, then on the right a viewer (2/3), an optional timeline (80px) and details (1/3). The header and tab bar are 72px each (CSS variables in `src/index.css`).
- `src/library/DataProvider.jsx` holds the library, spells and takes for the whole app and writes changes to IndexedDB (`src/storage/db.js`, hand-written wrapper, stores `animations`, `audio`, `spells`, `takes`). Built-ins come from `src/library/builtins.js` (procedural ones made by code) and `public/library/<kind>/index.json` (file ones).
- Per-frame work (camera → tracker → effects → canvas) runs in a requestAnimationFrame loop held in refs, outside React state. See `src/components/PinchCaster.jsx`.
- Use `ComingSoon` for any box whose feature isn't built yet.
- Theme: cyberpunk (dark, neon cyan and magenta, green for add buttons).

## Working with the owner

- The owner does not want to train models. Prefer pretrained models, installed packages, or methods that need no training. The plan is to recognise gestures by comparing them with 3–5 recorded examples using dynamic time warping. Their earlier MNIST networks don't apply here, so don't build on them or describe this project as reusing them.
- Explain new ideas clearly. The owner knows React and the basics of neural networks, but is new to video, motion, sound and sequences.
- Ask before adding a package beyond those in package.json, saying what it does and what it costs.
- Run `npm run lint` and `npm run build` before calling something finished, and say plainly what could not be checked without seeing the browser (camera, tracking, visuals).
- Don't create GitHub repositories or push without being asked.
