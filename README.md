# Gesture Spellbook

Move your hand in front of the camera and turn the movement into a spell: a
burst of gold coins, a flash of light, a fireball, with sound, drawn over the
video.

The app runs in the browser (Edge or Chrome). Hand tracking uses a pretrained
model that runs on your own machine, so no video is sent anywhere. Gestures
are recognised by comparing your movement with a few recorded examples, so
no model has to be trained.

## Running it

You need Node.js 20 or newer.

```
npm install
npm run dev
```

Then open http://localhost:5173 in Edge or Chrome and allow the camera when
asked.

`npm install` also runs `npm run setup`, which copies the MediaPipe runtime
into `public/mediapipe/` and downloads the hand model (about 8 MB) into
`public/models/`. Both folders are git-ignored. Run `npm run setup` again if
either goes missing.

| Command | What it does |
| --- | --- |
| `npm run dev` | Serves the app at http://localhost:5173 |
| `npm run check` | Checks the gesture maths, the built-in spells and the built-in sounds without a camera (see "Checking the maths") |
| `npm run make-spells` | Regenerates the Snap-Brightness and Push-Fireball spells (see "The built-in spells") |
| `npm run build` | Builds the app into `dist/` |
| `npm run lint` | Checks the code with ESLint |
| `npm run setup` | Puts the MediaPipe runtime and hand model into `public/` |

The port is fixed at 5173 on purpose. The browser keeps saved data per address,
so the app on another port would show an empty library.

## Quick start

The app comes with three spells ready to use. Built-in spells are named
*gesture*-*spell*:

| Spell | Gesture | Animation | Sound |
| --- | --- | --- | --- |
| **Pinch-Coins** | Press thumb and index fingertip together | Coins 🪙: spinning gold coins burst from the pinch | Spark-Chime |
| **Snap-Brightness** | Snap: middle finger off the thumb into the palm | Illumination: a point of light flares at the index fingertip and shines for about 3 s | Spark-Chime |
| **Push-Fireball** | Fist, then fling the hand open and push it at the camera | Fireball: forms at the palm and rushes towards you | Fire-Crackle |

1. **Spellbook → Spellbook tab.** Select a spell and press **Play**. It loops
   through all five recorded examples until you press **Pause**, showing which
   example is playing. Each one plays the hand, then the animation and sound
   together at the moment the spell would cast.
2. **Record tab.** Press **Start camera** and do one of the gestures. The
   spell's name flashes, its animation appears at your hand and its sound
   plays.

You can start a gesture from any hand position: only the way it ends has to
match. Either hand works.

If a spell never casts, or casts by accident, press **Make a copy** and change
the copy's **Sensitivity** (higher casts more easily). The **closest** reading
at the top of the Record view shows how near your movement is to a spell: it
casts when the first number drops below the second.

To make your own spell, press the green **+** in the Spellbook and then
**Record gesture**. The recorder shows its instructions on screen.

## Layout

A header runs across the top: the title on the left, the four modes on the
right. Each mode has its tabs along the bottom.

Most tabs share one layout: a **list** on the left sixth of the screen, and
on the right a **viewer** (top two thirds) above a **details** box (bottom
third). The Edit tab adds a video and audio **timeline** between the viewer
and details.

Anything not built yet shows a "Feature coming soon" box.

## Modes and tabs

### Spellbook mode (live)

Build spells first, then record video while the app recognises them.

**Animations.** The animation library, shared with Editing mode.
- List: every animation, built in or uploaded. The green + uploads files.
- Viewer: plays the selected animation on a loop (silently: sound always
  comes from audio files).
- Details: source, format, size and date, an editable description for
  uploaded files, Delete, and an Upload button at the bottom.
- Built in: **Coins 🪙**, **Illumination** and **Fireball**, all drawn by code.

**Audio.** The audio library, shared with Editing mode, laid out the same way.
The viewer is an audio player. Built in:
- **Spark-Chime**: a bright strike, then a rippling bell chime with a
  shimmer and an echo, 1.8 s, fading out
- **Fire-Crackle**: a whoosh and roar with crackles and pops that builds for
  0.9 s like the fireball, then dies away, 2 s.

**Spellbook.** Spells. A spell joins three separate things: a recorded
gesture, an animation and an audio file from the library.
- List: the built-in spells first, then your own. The green + makes a new
  spell.
- Viewer: one **Play / Pause** button plays the whole spell, looping through
  its examples (shown as "Example 2 of 5") until paused:
  - the recorded gesture, as a moving hand skeleton
  - at the moment it would cast (when the hand arrives at its final pose,
    for example the fingers touch), the animation and the audio together,
    at the animation's place on the hand.

  Nothing is cut short: each example plays until its longest part has
  finished. Pause freezes all of it. Parts the spell doesn't have are
  skipped. Markers along the top show which parts are set.
- Details:
  - name and description
  - **Record gesture / Add examples**, and **Clear**
  - sensitivity
  - the animation and audio pickers
  - when it was made and recorded
  - **Make a copy**
- Built-in spells can't be edited. Make a copy to change one.
- Recording a gesture turns the viewer into the camera. Each recording is
  trimmed to the part where your hand moved.

**Record.** Live casting. Start the camera and do a spell's gesture. When it is
recognised, the spell's name flashes, its animation appears at your hand and
its audio plays. Saving the video is coming next.

**Finalize** *(coming soon)*. Review a live recording, fix spells that fired
at the wrong moment or not at all, and export the video.

### Editing mode (after the fact)

Record video first, then find the gestures and add effects.

**Animations, Audio.** The same shared library as in Spellbook mode.

**Record** *(coming soon)*. Records plain video along with its hand-tracking
data, so gestures can be found later without running the hand model again.

**Edit.** Open a recording, select a stretch on the timeline, then apply an
animation and/or audio to only that stretch or to every similar gesture in
the video.
- List: recorded videos.
- Viewer: the open video.
- Timeline: a video track and an audio track.
- Details: "only the selected part" or "every similar gesture", plus the
  animation and audio pickers.

The controls are in place, but selecting and applying are coming soon.

### Animation Builder and Audio Lab *(coming soon)*

Designing animations from particles and shapes, and generating sounds by
layering waves. Whatever they make will be saved to the shared library.

## The built-in spells

They are JSON files in `public/library/spells/`, listed in its `index.json`.
Each holds five example recordings of its gesture: hand positions only
(21 points per hand per frame), no video.

- **Pinch-Coins** uses five real pinches recorded in the app.
- **Snap-Brightness** and **Push-Fireball** were generated, not recorded, by
  `scripts/make-spells.js`. It takes the real hand from the first frame of
  the Pinch-Coins recordings, so the proportions are a real tracked hand's,
  and bends its fingers frame by frame:
  - the snap goes from the thumb pressed on the middle fingertip to the
    middle finger snapped into the palm, in about 0.1 s
  - the fireball goes from a fist to a spread open hand pushed towards the
    camera, in about 0.3 s.

  Each example is moved, turned, scaled and timed a little differently, and
  tracker-like jitter is added. Each one goes through the same trimming as
  the in-app recorder. The generated poses are approximations of real hands,
  so if these two spells don't cast reliably with your hand, make a copy and
  raise its sensitivity, or record your own examples.

## How animations work

Each built-in animation is drawn by code on a canvas, every frame
(`src/effects/`). Each one appears at its own place on the hand:

| Animation | Appears at | How it is drawn |
| --- | --- | --- |
| Coins 🪙 | between thumb and index tip | Ten coins thrown out with air drag and gravity, spinning (drawn squashed sideways as they turn), fading out within about half a second. The glowing coin is drawn once into a small image and stamped, which is far faster than drawing emoji text with a glow every frame |
| Illumination | the index fingertip, following it as it moves | A flash ring, a large warm halo, a white-hot core, two crossing light streaks and drifting specks, added together with additive blending so overlapping light goes towards white. Full brightness for about 2 s, then it fades out by about 3 s |
| Fireball | the palm | A ball (white-hot to yellow, orange and deep red) that grows and drifts towards the centre as it "comes at" the camera, throwing off flame particles that cool from yellow to red to smoke, then bursts into embers |

Uploaded video and image files appear centred on the pinch point.

## How sound plays

The built-in sounds are computed sample by sample in JavaScript when the app
opens and saved as WAV files, so they play in a normal audio player in the
Audio tab (`src/effects/sparkSound.js`, `src/effects/fireSound.js`).

When a spell casts, its sound is played through the Web Audio API
(`src/effects/audioEngine.js`). Each sound is decoded once in advance and
kept in memory, so it starts within milliseconds of the cast. An `<audio>`
element would decode the file again each time, which adds a noticeable delay.

## The library

Animations and audio come from three places, and all appear in both modes:

- **Made by code.** Coins, Illumination and Fireball are drawn live. Spark
  chime and Fire-Crackle are computed when the app opens.
- **Built-in files.** Files in `public/library/animations/` and
  `public/library/audio/`, each listed in that folder's `index.json` (see
  `public/library/README.md`).
- **Uploaded.** Files you add with the green + or the upload button.

Accepted formats are ones Edge and Chrome can play without extra software:

- Animations: WebM, MP4, GIF, animated WebP or PNG, and Lottie JSON. Lottie
  files can be saved and assigned, but aren't drawn yet. WebM can have a
  transparent background, which suits effects drawn over video.
- Audio: MP3, WAV, OGG, Opus, M4A/AAC, FLAC, WebM.

## Where things are saved

Built-in spells are files in `public/library/spells/`, so they are part of
the project and its git history.

Your own spells (with their recorded gestures) and uploaded files are saved
in the browser's IndexedDB database for this site. They are still there next
time the app is opened, in the same browser at the same address. The app
asks the browser to keep the data even when disk space runs low. An
export/import backup file is planned.

None of that is in the project folder, so your own spells and uploads never
end up in git. `.gitignore` also excludes video files saved into the project
(`recordings/`, `exports/`, and `.webm`, `.mp4`, `.mov` and `.mkv` files),
except built-in animations in `public/library/`.

## How gestures are recognised

1. **Hand tracking (pretrained model).** MediaPipe's Hand Landmarker finds
   up to two hands in each camera frame and gives 21 points per hand: the
   wrist, each knuckle and each fingertip.
2. **Turning a frame into numbers** (`src/gestures/features.js`). Each frame
   becomes 46 numbers:
   - the hand's shape: each point relative to the wrist, divided by the palm
     length, so distance from the camera doesn't matter
   - the distance from the thumb tip to each fingertip, weighted ×3. This is
     what makes a pinch or a snap stand out.
   - where the hand is relative to its average position, for gestures drawn
     in the air.

   Left hands are mirrored so either hand works.
3. **Recording** (`src/gestures/trim.js`). The recorder captures 2.5 seconds
   and keeps only the stretch where the hand moved away from its starting
   pose and settled into its final pose.
4. **The cast moment.** For each example, the moment the hand arrives at its
   final pose: for a pinch, when the fingers touch. Spells cast then, not
   when the hand has finished holding still.
5. **Matching** (`src/gestures/recognizer.js`, `src/gestures/dtw.js`). Every
   other camera frame:
   - only the end of each example is used: its last 60% up to the cast
     moment. That is why a gesture can start from any hand position.
   - the last moment of live movement is compared with it using *dynamic
     time warping*, which lines two movements up even when one is faster in
     places, plus a term for how far apart the final poses are, so a
     gesture that ends wrong (a snap undone instead of done) doesn't match
   - if the closest spell is under its limit, it casts, followed by a
     1-second pause before it can cast again
   - a movement much smaller than the examples is skipped, so a still hand
     never casts.
6. **Each spell's limit** comes from two things, then is scaled by its
   sensitivity:
   - how much the spell's own examples differ from each other (twice the
     largest difference, between 0.3 and 0.9)
   - the nearest movement that must *not* cast it: the other spells'
     examples, and its own examples played backwards (releasing a pinch
     instead of pressing it). The limit stays below 0.65 of that distance,
     so spells can't set each other off.

## Checking the maths

`npm run check` tests, with no camera:

- dynamic time warping on small cases worked out by hand
- the recogniser on a synthetic hand
- the three built-in spells against each other: each example is played
  as a live stream to a recogniser that has all three spells but not that
  example, so it has never seen it
- the built-in sounds.

Current results:

| Test | Result |
| --- | --- |
| DTW on small hand-worked cases | exact |
| Synthetic pinch recordings, trimmed from 2.5 s | to 0.37–0.40 s |
| Synthetic live pinch | casts once, as it closes (distance 0.111, limit 0.536) |
| Synthetic slower pinch | casts (0.159) |
| Synthetic half pinch / closing into a fist | no cast (0.598 / 0.687) |
| Still hand, drifting hand, waving | no cast (too little hand-shape movement) |
| Synthetic pinch from a half-curled start | needs sensitivity ×1.3 (0.649): these three synthetic examples are very uniform, so their limit is tight |
| Pinch-Coins, each real example unseen | all 5 cast Pinch-Coins only (0.57–0.79, limit 0.90) |
| Snap-Brightness, each example unseen | all 5 cast Snap-Brightness only (0.19–0.52, limits 0.58–0.60) |
| Push-Fireball, each example unseen | all 5 cast Push-Fireball only (0.25–0.76, limits 0.86–0.90) |
| All 15, started from a different position (first third replaced by the middle pose) | all cast their own spell |
| All 15, played backwards | none cast (1.04+ / 0.66+ / 1.10+) |
| Spark-Chime | 1.80 s, peak 0.8, ends in silence; loudness per 0.3 s 0.239 → 0.208 → 0.118 → 0.055 → 0.022 → 0.004 |
| Fire-Crackle | 2.00 s, peak 0.85, ends in silence; crackle peaks 6.9× the average level; loudest at 0.8–1.0 s (the burst), then dies away |

## Packages

| Package | Why |
| --- | --- |
| `@mediapipe/tasks-vision` | Google's pretrained hand-tracking model and its WebAssembly runtime (Apache-2.0). Runs locally, on the GPU when it can |
| `react`, `react-dom` | The page |
| `react-router-dom` | Modes and tabs are routes, e.g. `/spellbook/audio` |
| `vite`, `eslint` and plugins | Development server, build and lint (development only) |

Everything else comes from the browser: camera (`getUserMedia`), drawing
(canvas), sound (Web Audio), recording (`MediaRecorder`, next) and storage
(IndexedDB).

## Code layout

```
src/
  App.jsx              routes for the four modes
  modes/               each mode and its list of tabs
  tabs/                the tab screens (library, spellbook, record, finalize, edit)
  components/          header, tab bar, list/viewer/details layout, previews,
                       GestureRecorder, SpellPlayback, LiveCaster
  tracking/            MediaPipe wrapper, camera loop hook, landmark helpers, skeleton drawing
  gestures/            features, DTW, trimming, the recogniser
  effects/             coins, illumination, fireball, the sounds, WAV encoder,
                       audio engine, effect player
  library/             shared data (library files, spells), accepted formats, built-ins
  storage/db.js        small IndexedDB wrapper
public/library/        built-in animation and audio files, and the built-in spells
scripts/               MediaPipe setup, maths checks, spell generator
```

## Next steps

1. Record and save video, with microphone and effect sounds, in both Record
   tabs.
2. Finalize: play back a live recording with its effects, and export.
3. Editing: video and audio timeline, select a stretch, apply effects, find
   similar gestures, export.
4. Export/import the spellbook as a backup file.
5. The Animation Builder and Audio Lab.
