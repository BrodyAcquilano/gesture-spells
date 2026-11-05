# Gesture Spellbook

Move your hand in front of the camera and turn the movement into a spell: a
burst of sparks, a glowing trail, a fireball, with sound, drawn over the
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
| `npm run check` | Checks the gesture maths and the spark chime without a camera (see "Checking the maths") |
| `npm run build` | Builds the app into `dist/` |
| `npm run lint` | Checks the code with ESLint |
| `npm run setup` | Puts the MediaPipe runtime and hand model into `public/` |

The port is fixed at 5173 on purpose. The browser keeps saved data per address,
so the app on another port would show an empty library.

## Quick start: cast the Pinch spark

The app comes with one spell ready to use: **Pinch spark**. Its gesture was
recorded from five real pinches, and it already has the **Sparks ✨**
animation and the **Spark chime** sound.

1. **Spellbook → Spellbook tab.** Select **Pinch spark** and press **Play**
   to see the recorded pinch, then the sparks and chime together.
2. **Record tab.** Press **Start camera**, hold your hand open toward the
   camera, then press your thumb and index fingertip together and hold. The
   spell's name flashes, sparks burst from your fingers and the chime plays.

Either hand works. If it never casts, or casts by accident, press **Make a
copy** on the spell and change the copy's **Sensitivity** (higher casts more
easily). The **closest** reading at the top of the Record view shows how near
your movement is to a spell: it casts when the first number drops below the
second.

To make your own spell, press the green **+** in the Spellbook and then
**Record gesture**. The recorder shows its instructions on screen.

## Layout

A header runs across the top: the title on the left, the four modes on the
right. Each mode has its tabs along the bottom.

Most tabs share one layout: a **list** on the left sixth of the screen, and on the right
a **viewer** (top two thirds) above a **details** box (bottom third). The
Edit tab adds a video and audio **timeline** between the viewer and details.

Anything not built yet shows a "Feature coming soon" box.

## Modes and tabs

### Spellbook mode (live)

Build spells first, then record video while the app recognises them.

**Animations.** The animation library, shared with Editing mode.
- List: every animation, built in or uploaded. The green + uploads files.
- Viewer: plays the selected animation (silently: sound always comes from
  audio files).
- Details: source, format, size and date, an editable description for
  uploaded files, Delete, and an Upload button at the bottom.
- Built in: **Sparks ✨**, drawn by code.

**Audio.** The audio library, shared with Editing mode, laid out the same way.
The viewer is an audio player. Built in: **Spark chime**, a 1.8-second
magical chime that fades out with the sparks.

**Spellbook.** Spells. A spell joins three separate things: a recorded
gesture, an animation and an audio file from the library.
- List: built-in spells first (Pinch spark), then your own. The green + makes
  a new spell.
- Viewer: one **Play / Pause** button plays the whole spell:
  - the recorded gesture, as a moving hand skeleton
  - then, at the moment it would cast, the animation and the audio together.

  Nothing is cut short: playback lasts until the longest part has finished.
  Pause freezes all of them. Each play uses the next recorded example. Parts
  the spell doesn't have are skipped. Markers along the top show which parts
  are set.
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

## The library

Animations and audio come from three places, and all appear in both modes:

- **Made by code.** The ✨ sparks are drawn live. The spark chime is computed
  sample by sample when the app opens and saved as a WAV file, so it plays in
  a normal audio player.
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

Built-in spells are files in `public/library/spells/` (listed in its
`index.json`), so they are part of the project and its git history. A
recorded gesture is hand positions only (21 points per hand per frame), not
video.

Your own spells (with their recorded gestures) and uploaded files are saved in the
browser's IndexedDB database for this site. They are still there next time
the app is opened, in the same browser at the same address. The app asks the
browser to keep the data even when disk space runs low. An export/import
backup file is planned.

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
     what makes a pinch stand out.
   - where the hand is relative to its average position, for gestures drawn
     in the air.

   Left hands are mirrored so either hand works.
3. **Recording** (`src/gestures/trim.js`). The recorder captures 2.5 seconds
   and keeps only the stretch where the hand moved away from its starting
   pose and settled into its final pose.
4. **Matching** (`src/gestures/recognizer.js`, `src/gestures/dtw.js`). Every
   other camera frame:
   - the last moment of live movement (about as long as the example) is
     compared with each recorded example
   - the comparison uses *dynamic time warping*, which lines two movements
     up even when one is faster in places
   - if the closest spell is under its limit, it casts, followed by a
     1-second pause before it can cast again
   - each spell's limit comes from how closely its own examples agree with
     each other, scaled by its sensitivity setting
   - a movement much smaller than the examples is skipped, so a still hand
     never casts.

## Checking the maths

`npm run check` tests the recogniser on synthetic hands, on the real
recordings in the Pinch spark spell (no camera needed), and the spark chime.
Current results:

| Test | Result |
| --- | --- |
| DTW on small hand-worked cases | exact |
| Recorded pinches trimmed from 2.5 s | to 0.37–0.40 s |
| Limit learned from 3 examples | 0.251 |
| Live pinch | casts once, 50 ms before it fully closes (distance 0.171) |
| Slower live pinch | casts (0.204) |
| Half pinch, fingers stop apart | no cast (0.411) |
| Closing into a fist | no cast (0.604) |
| Still hand, drifting hand, waving | no cast (too little hand-shape movement) |
| Real pinches: each one replayed to a recogniser built from the other four | all 5 cast (0.43–0.54, limit 0.60) |
| Real pinches played backwards (releasing) | none cast (1.18 or more) |
| Spark chime | 1.80 s, peak 0.8, ends in silence, loudness falls 0.215 → 0.007 after the bells peak |

Real hands vary more than synthetic ones, which is why the real pinches sit
closer to their limit. The sensitivity slider adjusts that limit per spell.

## Packages

| Package | Why |
| --- | --- |
| `@mediapipe/tasks-vision` | Google's pretrained hand-tracking model and its WebAssembly runtime (Apache-2.0). Runs locally, on the GPU when it can |
| `react`, `react-dom` | The page |
| `react-router-dom` | Modes and tabs are routes, e.g. `/spellbook/audio` |
| `vite`, `eslint` and plugins | Development server, build and lint (development only) |

Everything else comes from the browser: camera (`getUserMedia`), drawing
(canvas), sound (`<audio>`), recording (`MediaRecorder`, next) and storage
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
  effects/             sparks particles, spark chime synthesis, WAV encoder, effect player
  library/             shared data (library files, spells), accepted formats, built-ins
  storage/db.js        small IndexedDB wrapper
public/library/        built-in animation and audio files, and packaged spells
scripts/               MediaPipe setup, maths checks
```

## Next steps

1. Record and save video, with microphone and effect sounds, in both Record
   tabs.
2. Finalize: play back a live recording with its effects, and export.
3. Editing: video and audio timeline, select a stretch, apply effects, find
   similar gestures, export.
4. Export/import the spellbook as a backup file.
5. More default animations and sounds, then the Animation Builder and Audio
   Lab.
