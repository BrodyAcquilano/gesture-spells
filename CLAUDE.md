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
- `npm run check` tests the gesture maths (DTW, trimming, recognition on synthetic hands), the three built-in spells against each other, and the built-in sounds, in Node without a camera
- `npm run make-spells` regenerates the generated built-in spells (Snap-Brightness, Push-Fireball) from the real hand in pinch-coins.json
- `npm run lint`, `npm run build`

## Stack and layout

React 19, Vite, react-router-dom, plain JavaScript (no TypeScript). Hand tracking is `@mediapipe/tasks-vision` (Hand Landmarker, VIDEO mode, GPU delegate), with files served locally from `public/`. Target browsers: Edge (the owner's browser) and Chrome.

- `src/modes/` defines each mode's tabs. `src/components/ModeShell.jsx` turns them into nested routes (`/spellbook/audio`) and the bottom tab bar.
- `src/components/Workspace.jsx` is the shared layout: list 1/6 on the left, then on the right a viewer (2/3), an optional timeline (80px) and details (1/3). The header and tab bar are 72px each (CSS variables in `src/index.css`).
- `src/library/DataProvider.jsx` holds the library, spells and recordings for the whole app. Spells are files in `public/library/spells/` (committed); recordings are in `recordings/<id>/` (video.mp4|webm, track.json, meta.json) and exports in `exports/`, both git-ignored. They are read and written through the dev-server middleware in `server/storage.js` (client: `src/storage/projectApi.js`); a browser page can't write files itself. Uploaded animation/audio files are saved into `public/library/<kind>/` and listed in its `index.json` (committed). There is no database: IndexedDB (`src/storage/db.js`) is only read once to move data from older versions into files. Built-in library items come from `src/library/builtins.js` (procedural ones made by code) and `public/library/<kind>/index.json` (file ones).
- Per-frame work (camera → tracker → recogniser → effects → canvas) runs in a requestAnimationFrame loop outside React state: `src/tracking/useHandCamera.js` owns the camera and loop, components pass an onFrame callback (`LiveCaster`, `GestureRecorder`).
- Gestures: a spell stores `gesture.examples` (trimmed landmark frames, from moving to settled). Live recognition (`createLiveMatcher` in `src/gestures/recognizer.js`) waits for the hand to settle after moving (movement = mean of the 5 fastest landmarks), then compares the last few seconds with every example by subsequence DTW (example start free, ends aligned) plus a final-pose term; nearest example's spell wins if under its limit (from each example's nearest-fellow distance, capped by the nearest other spell). Features weight the path (from the final position) highest. All numbers are in `DEFAULT_SETTINGS`, tuned with `npm run tune` on the owner's real recordings; re-run it after examples change. `npm run check` treats the real recordings as the strict test. No training. Keep `src/gestures/`, `src/tracking/landmarks.js` and `src/effects/*Sound.js` free of browser-only imports so the Node scripts can run them.
- Every spell is a JSON file in `public/library/spells/` (listed in `index.json`); there is no built-in/user distinction: all can be edited, copied ("Make a copy") and deleted, and changes reach GitHub with the next push. The owner wants this. The shipped three are named Gesture-Spell with capitals (Pinch-Coins, Snap-Brightness, Push-Fireball; files lowercase). All three now hold the owner's real recordings (Push-Fireball also has 5 generated examples). `scripts/make-spells.js` only recreates Push-Fireball if its file is missing and must never overwrite existing spells. The owner snaps with the palm towards themself (back of the hand to the camera, turning over), the realistic way; don't generate or assume palm-facing snaps.
- Record (`LiveCaster`) records the raw camera + microphone with MediaRecorder (`src/record/videoRecorder.js`, MP4 preferred), plus the hand track and casts; effect sounds are muted while recording. Finalize (`FinalizePlayer`) replays the video mirrored with effects at the cast times and exports via canvas.captureStream + Web Audio (video element and effect sounds routed into a MediaStreamDestination) to MP4, saved to `exports/` and offered as a download.
- The Spellbook viewer is `SpellPlayback`: one Play/Pause button loops through the examples ("Example 2 of 5") until paused; each plays the gesture, with animation + audio together at the cast moment (arrivalTime), never clipped (the next example waits for `effectPlayer.busy()` to go false). No separate audio player there.
- Animations drawn by code live in `src/effects/` (coins, illumination, fireball) and are registered in `src/effects/animations.js` with an anchor on the hand (pinch point, index tip, palm). Keep them cheap per frame: stamp pre-rendered sprites, avoid shadowBlur per particle (the owner noticed lag).
- Sound on cast goes through `src/effects/audioEngine.js` (Web Audio, decoded once, preloaded) for low latency, not `<audio>` elements.
- Animations and audio are separate library items, joined only in a spell. Animations are silent. Audio built-ins are rendered to WAV files so they play in a normal audio player.
- Use `ComingSoon` for any box whose feature isn't built yet.
- Every library item (including the ones made by code: Coins, Brightness, Fireball; Spark-Chime, Light-Swell, Fire-Crackle) is an entry in `public/library/<kind>/index.json` (`procedural` name or `file`), renameable and deletable; the server finds entries by id. Never label them "built-in". Deleting an item a spell uses is blocked with a centre pop-up (`useToast`). Every delete asks through the centre Confirm/Cancel dialog (`useConfirm` in `src/components/toast.js`), never `window.confirm`; Delete buttons sit at the bottom of the details box.
- Theme: cyberpunk (dark, neon cyan and magenta, green for add buttons).

## Working with the owner

- The owner does not want to train models. Prefer pretrained models, installed packages, or methods that need no training. The plan is to recognise gestures by comparing them with 3–5 recorded examples using dynamic time warping. Their earlier MNIST networks don't apply here, so don't build on them or describe this project as reusing them.
- Explain new ideas clearly. The owner knows React and the basics of neural networks, but is new to video, motion, sound and sequences.
- Ask before adding a package beyond those in package.json, saying what it does and what it costs.
- Run `npm run check`, `npm run lint` and `npm run build` before calling something finished, and say plainly what could not be checked without seeing the browser (camera, tracking, visuals, sound). Headless Edge (`msedge --headless=new --screenshot`) works for layout screenshots, but IndexedDB never opens there, so saved data cannot be checked that way.
- Don't create GitHub repositories or push without being asked.
- The dev server must be running for spells to be editable and for recording; without it spells load read-only from the static files.
