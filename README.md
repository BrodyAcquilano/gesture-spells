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

Then open http://localhost:5173 in Edge or Chrome and allow the camera (and
the microphone, for recording) when asked.

The dev server also saves files for the app (`server/storage.js`): spells
into `public/library/spells/`, uploaded animations and sounds into
`public/library/animations/` and `public/library/audio/`, recordings into
`recordings/` and finished videos into `exports/`. A browser page can't write
files by itself, so editing, uploading and recording only work while
`npm run dev` is running.

`npm install` also runs `npm run setup`, which copies the MediaPipe runtime
into `public/mediapipe/` and downloads the hand model (about 8 MB) into
`public/models/`. Both folders are git-ignored. Run `npm run setup` again if
either goes missing.

| Command | What it does |
| --- | --- |
| `npm run dev` | Serves the app at http://localhost:5173 |
| `npm run check` | Checks the gesture maths, the spells and the sounds made by code, without a camera (see "Checking the maths") |
| `npm run make-spells` | Recreates Push-Fireball with generated examples if its file is missing; never touches existing spells (see "The spells") |
| `npm run tune` | Tries recogniser settings on your recorded examples and prints the best (see "Tuning the recogniser") |
| `npm run build` | Builds the app into `dist/` |
| `npm run lint` | Checks the code with ESLint |
| `npm run setup` | Puts the MediaPipe runtime and hand model into `public/` |

The port is fixed at 5173 on purpose. The browser keeps saved data per address,
so the app on another port would show an empty library.

## Quick start

The app comes with three spells ready to use, named *Gesture*-*Spell*:

| Spell | Gesture | Animation | Sound |
| --- | --- | --- | --- |
| **Pinch-Coins** | Press thumb and index fingertip together | Coins: spinning gold coins burst from the pinch | Spark-Chime |
| **Snap-Brightness** | Snap: middle finger off the thumb into the palm | Brightness: a point of light flares at the index fingertip and shines for about 3 s | Light-Swell |
| **Push-Fireball** | Fist, then fling the hand open and push it at the camera | Fireball: forms at the palm and rushes towards you | Fire-Crackle |

1. **Spellbook → Spellbook tab.** Select a spell and press **Play**. It loops
   through all five recorded examples until you press **Pause**, showing which
   example is playing. Each one plays the hand, then the animation and sound
   together at the moment the spell would cast.
2. **Record tab.** Press **Start camera** and do one of the gestures. The
   spell's name flashes, its animation appears at your hand and its sound
   plays. Press **● Record** to record a video while you cast.
3. **Finalize tab.** Pick the recording. It plays back with the spells'
   animations and sounds added where you cast them. Press **Export video**
   for a finished MP4 to download.

You can start a gesture from any hand position: only the way it ends has to
match. Either hand works.

If a spell never casts, or casts by accident, change its **Sensitivity**
(higher casts more easily). The **closest** reading
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

Every delete (a spell, an animation, a sound, a recording, a gesture's
examples, a cast in Finalize) asks first, in a **Confirm / Cancel** dialog
in the centre of the screen. The Delete buttons are at the bottom of the
details box.

## Modes and tabs

### Spellbook mode (live)

Build spells first, then record video while the app recognises them.

**Animations.** The animation library, shared with Editing mode.
- List: every animation, the ones that come with the app and the ones you
  upload. The green + uploads files.
- Viewer: plays the selected animation on a loop (silently: sound always
  comes from audio files).
- Details: the name (editable, to rename it), source, format, size and date,
  an editable description, **Delete** at the bottom, and an Upload button.
  Uploaded files are saved into `public/library/animations/` (see "Where
  things are saved").
- Comes with: **Coins**, **Brightness** and **Fireball**, all drawn by code.
  They can be renamed and deleted like any upload.
- An animation a spell uses can't be deleted: a message in the centre of the
  screen names the spells that use it. Choose another animation for those
  spells first.

**Audio.** The audio library, shared with Editing mode, laid out the same way,
with the same renaming, deleting and in-use protection. The viewer is an
audio player. Comes with:
- **Spark-Chime**: a bright strike, then a rippling bell chime with a
  shimmer and an echo, 1.8 s, fading out
- **Light-Swell**: a glassy ping as the light flares, then a warm, bright
  chord that swells and holds while it shines, with an airy shimmer and
  twinkles, fading out with the light, 3.3 s
- **Fire-Crackle**: a whoosh and roar with crackles and pops that builds for
  0.9 s like the fireball, then dies away, 2 s.

**Spellbook.** Spells. A spell joins three separate things: a recorded
gesture, an animation and an audio file from the library.
- List: every spell. The green + makes a new one.
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
  - **Make a copy** and **Delete spell**
- Every spell can be edited and deleted, including the three that come with
  the app. Each is a file in the repository (see "The spells"), so changes,
  new spells and deletions go to GitHub with your next push.
- Recording a gesture turns the viewer into the camera. Each recording is
  trimmed to the part where your hand moved.

**Record.** Live casting and recording.
- Left column, split in half:
  - **Recordings** (top). **● New recording** (or the green +) connects to
    the camera. Selecting a saved recording plays it back instead, with its
    spells' animations and sounds.
  - **Spells to recognise** (bottom), for a new recording: tick boxes with a
    green tick to the left of each spell's name, plus All and None. Untick a
    spell so it can't fire by mistake, for example Pinch-Coins while you
    snap, since a pinch and a snap look alike. The choice is saved with the
    recording and can't be changed afterwards, so this half is empty when a
    saved recording is selected. Spells without a recorded gesture can't be
    ticked.
- Viewer, for a new recording: the camera. When a ticked spell's gesture is
  recognised, its name flashes, its animation appears at your hand and its
  sound plays. A bar along the bottom has **● Start recording** /
  **■ Stop recording** with a timer, and **Stop camera**.
- Details: the name and description for the next recording (or editable
  for a saved one), and for a saved one **Open in Finalize** and, at the
  bottom, **Delete recording**.
- While recording, the animations still show but their sounds are muted, so
  the microphone doesn't record them (Finalize adds them cleanly).
- Each recording is saved into `recordings/<id>/`:
  - `video.mp4`: the camera and microphone, exactly as filmed, without
    effects. It is MP4 where the browser can record it, otherwise WebM.
  - `track.json`: the hand positions in every frame
  - `meta.json`: its name, description, length, the spells that were
    ticked, and each spell cast (when, which spell, and where the hand was)
- `recordings/` is git-ignored: recordings stay on this computer.

**Finalize.** Turn a recording into a finished video.
- List: your recordings.
- Viewer: the recording plays mirrored, as it looked live, with each cast's
  animation at the hand and its sound, at the moment it was cast. Animations
  that follow the hand (Brightness) follow the recorded hand. **Play /
  Pause**, a position slider and the time.
- Details:
  - the recording's name and description (editable), date, length and format
  - the spells cast, each with its time, animation and sound, and **×** to
    remove one that fired by mistake
  - **Detect spells again**: looks for spells in the recorded hand movements
    with the spellbook as it is now, using only the spells that were ticked
    for that recording. Use it after changing a spell, or for a recording
    made in Editing mode.
- **Export video** plays the recording through once in real time, recording
  the picture with the animations, your microphone and the spell sounds into
  one file: MP4 where the browser can (Edge can), otherwise WebM. It is
  saved into `exports/` (git-ignored) and offered as a **Download** link.

### Editing mode (after the fact)

Record video first, then find the gestures and add effects.

**Animations, Audio.** The same shared library as in Spellbook mode.

**Record.** Records video, microphone and hand movements like the
Spellbook's Record tab, but without recognising spells as you go. The
recordings are the same ones Finalize lists.

**Edit.** Open a recording, select a stretch on the timeline, then apply an
animation and/or audio to only that stretch or to every similar gesture in
the video.
- List: your recordings.
- Viewer: the open video.
- Timeline: a video track and an audio track.
- Details: "only the selected part" or "every similar gesture", plus the
  animation and audio pickers.

The controls are in place, but selecting and applying are coming soon.

### Animation Builder and Audio Lab *(coming soon)*

Designing animations from particles and shapes, and generating sounds by
layering waves. Whatever they make will be saved to the shared library.

## The spells

Every spell is a JSON file in `public/library/spells/`, listed in its
`index.json`, so spells are part of the repository: a spell you make, edit
or delete in the app is committed with your next push. A spell holds its
name, description, animation, audio, sensitivity and its gesture examples:
hand positions only (21 points per hand per frame), no video. New spells get
a file named after them, such as `my-spell-x7k2.json`; renaming a spell later
keeps its file name.

The three that come with the app:

- **Pinch-Coins**: real pinches recorded in the app, in two styles (a small
  and a larger pinch), with both hands.
- **Snap-Brightness**: real snaps, done the way people actually snap, with
  the palm towards yourself: the camera first sees the back of the hand,
  and the hand turns over to show the front as it snaps.
- **Push-Fireball**: real recordings plus five generated examples from
  `scripts/make-spells.js`, which bends the fingers of the real hand from
  the Pinch-Coins recordings from a fist to a spread hand pushed towards the
  camera. `npm run make-spells` only recreates this spell if its file is
  missing; it never touches existing spells.

Recording more examples in your own style, with the hand you use, makes a
spell more reliable. Very different styles of the same gesture are fine as
long as each style has a few examples.

## How animations work

Each animation that comes with the app is drawn by code on a canvas, every frame
(`src/effects/`). Each one appears at its own place on the hand:

| Animation | Appears at | How it is drawn |
| --- | --- | --- |
| Coins | between thumb and index tip | Ten coins thrown out with air drag and gravity, slowly spinning (drawn squashed sideways as they turn), fading out over about a second. The glowing coin is drawn once into a small image and stamped, which is far faster than drawing emoji text with a glow every frame |
| Brightness | the index fingertip, following it as it moves | A flash ring, a large warm halo, a white-hot core, two crossing light streaks and drifting specks, added together with additive blending so overlapping light goes towards white. Full brightness for about 2 s, then it fades out by about 3 s |
| Fireball | the palm | A ball (white-hot to yellow, orange and deep red) that grows and drifts towards the centre as it "comes at" the camera, throwing off flame particles that cool from yellow to red to smoke, then bursts into embers |

Uploaded video and image files appear centred on the pinch point.

## How sound plays

The sounds that come with the app are computed sample by sample in JavaScript when the app
opens and saved as WAV files, so they play in a normal audio player in the
Audio tab (`src/effects/sparkSound.js`, `src/effects/fireSound.js`,
`src/effects/lightSound.js`).

When a spell casts, its sound is played through the Web Audio API
(`src/effects/audioEngine.js`). Each sound is decoded once in advance and
kept in memory, so it starts within milliseconds of the cast. An `<audio>`
element would decode the file again each time, which adds a noticeable delay.

## The library

Every animation and sound is an entry in `public/library/animations/index.json`
or `public/library/audio/index.json`, so renaming, describing and deleting
them is saved into the project. They come from:

- **Made by code.** Coins, Brightness and Fireball are drawn live.
  Spark-Chime, Light-Swell and Fire-Crackle are computed when the app opens.
  Their entries have a `procedural` name instead of a file. A deleted one
  can be brought back by restoring its entry from git.
- **Files.** Files in `public/library/animations/` and `public/library/audio/`
  (see `public/library/README.md`).
- **Uploaded.** Files you add with the green + or the upload button. They
  are saved into the library folders and listed in their
  `index.json`, with a tidied file name (`My Sound (1).WAV` becomes
  `my-sound-1.wav`), so they are part of the repository too.

Accepted formats are ones Edge and Chrome can play without extra software:

- Animations: WebM, MP4, GIF, animated WebP or PNG, and Lottie JSON. Lottie
  files can be saved and assigned, but aren't drawn yet. WebM can have a
  transparent background, which suits effects drawn over video.
- Audio: MP3, WAV, OGG, Opus, M4A/AAC, FLAC, WebM.

## Where things are saved

| What | Where | In git? |
| --- | --- | --- |
| Spells, with their gestures | `public/library/spells/` (one JSON file each) | Yes: committed with your next push |
| Recordings | `recordings/<id>/` (video, hand track, details) | No: git-ignored, stays on this computer |
| Exported videos | `exports/` | No: git-ignored |
| Uploaded animations and sounds | `public/library/animations/` and `public/library/audio/` (listed in each `index.json`) | Yes: committed with your next push |

Everything is a plain file in the project folder; there is no database.
The files are written by the dev server, because a web page can't write
files on your computer by itself. The page sends them to `npm run dev`,
which saves them (`server/storage.js`).

Earlier versions kept spells and uploads in the browser's database; the app
moves anything it finds there into files the first time it opens.

`.gitignore` excludes `recordings/`, `exports/` and any video files saved
elsewhere in the project (`.webm`, `.mp4`, `.mov`, `.mkv`), except in
`public/library/`, so uploaded video animations are committed.

## How gestures are recognised

1. **Hand tracking (pretrained model).** MediaPipe's Hand Landmarker finds
   up to two hands in each camera frame and gives 21 points per hand: the
   wrist, each knuckle and each fingertip.
2. **Recording an example** (`src/gestures/trim.js`). The recorder captures
   2.5 seconds and keeps only the stretch from when the hand started moving
   to when it settled into its final pose.
3. **Turning a frame into numbers** (`src/gestures/features.js`). Each frame
   becomes a list of numbers, in groups, each group multiplied by a weight:
   - the hand's shape: each point relative to the wrist, divided by the palm
     length, so distance from the camera doesn't matter (×1)
   - the distance from the thumb tip to each fingertip (×2)
   - **where the hand moves**, measured from where it ends up, in palm
     lengths (×4). On your real recordings this is what tells a pinch, a
     snap and a fireball apart best.

   Left hands are mirrored so either hand works. The movement is resampled
   to one step every 60 ms, so quick and slow gestures are compared at the
   same time resolution.
4. **Finding a live gesture** (`createLiveMatcher` in
   `src/gestures/recognizer.js`). The app watches how much the hand moves
   from frame to frame: the average of the five points that moved most, so
   a pinch, where only two fingers move, still counts. When the hand has
   been clearly moving and then settles, a gesture has just been completed.
   That is the moment it casts, with the animation where the hand is.
5. **Matching it.** The last few seconds of movement up to that moment are
   compared with every recorded example using *dynamic time warping*, which
   lines two movements up even when one is faster in places. The example
   may line up with any later part of those seconds, since the live stretch
   also holds whatever the hand did before, but both must end together.
   A term for how far apart the two final poses are is added, so a gesture
   that ends wrong (a snap undone instead of done) doesn't match. The spell
   of the closest example wins, if it is within that spell's limit.
6. **Each spell's limit** comes from its own examples: how close each one
   is to its nearest fellow example (90% of the way up that list, ×1.5). A
   spell done in two styles still gets an honest limit, because each
   example is near the others of its own style. The limit also stays below
   the distance to the nearest example of another spell, so spells don't
   set each other off. The spell's sensitivity then scales it.

The "last move" reading at the top of the Record tab's camera view shows,
after each movement, the nearest spell, how close the movement was and that
spell's limit: it cast if the first number is below the second.

## Tuning the recogniser

`npm run tune` (`scripts/tune-recognizer.js`) replays every recorded
example as if performed live (hold still, gesture, hold still) through the
same live matcher, to a recogniser that has never seen that example, and
counts:
- correct casts (within 0.25 s of the gesture finishing)
- late casts
- wrong spells
- misses
- false alarms (a cast from the gesture played backwards).

Starting from the current settings it changes one setting at a time, keeps
whatever scores better, and prints the best settings to copy into
`DEFAULT_SETTINGS` in `src/gestures/recognizer.js`. Run it again after
recording new examples.

The current settings came from that process on your recordings. Two things
mattered most:
- **Cutting live movement the same way examples are cut** (from moving to
  settled), instead of sliding a fixed-length window over the camera feed.
  That took Pinch-Coins from never casting to casting.
- **Weighting the movement path above finger details.** Pinch and snap
  both end with the thumb near the index finger, so finger details alone
  confused them.

## Checking the maths

`npm run check` tests, with no camera:

- dynamic time warping on small cases worked out by hand
- recording trimming, and things that must never cast on a synthetic hand
  (a still hand, a drifting hand, a wave, closing into a fist, a half pinch)
- every spell's real recordings replayed live through the same matcher as
  the app, each to a recogniser that has never seen it. Strict checks: no
  example casts another spell, nothing played backwards casts, and at least
  80% of examples cast their own spell. Misses are listed.
- the sounds made by code.

Current results:

| Test | Result |
| --- | --- |
| DTW on small hand-worked cases | exact |
| Synthetic pinch recordings, trimmed from 2.5 s | to 0.40 s |
| Still hand, drifting hand, waving, half pinch, closing into a fist | no cast |
| Real recordings, unseen: casting their own spell | 32 of 36 (89%): Pinch-Coins 4/6, Snap-Brightness 17/19, Push-Fireball 11/11 |
| Real recordings: casting another spell | none |
| Real recordings played backwards: casting anything | none |
| Synthetic live pinch (slow, hand perfectly still) | reported only: too little movement to count as a gesture with settings tuned on real pinches |
| Light-Swell | 3.30 s, peak 0.8, ends in silence; holds while the light shines, then fades |
| Spark-Chime | 1.80 s, peak 0.8, ends in silence; loudness falls 0.239 → 0.004 over 0.3 s steps |
| Fire-Crackle | 2.00 s, peak 0.85, ends in silence; crackle peaks 6.9× the average level; loudest at the burst, then dies away |

The missed examples are Pinch-Coins 1 (a glitch in the recording: it is far
from every other example), Pinch-Coins 3, and Snap-Brightness 5 and 13.
Deleting or re-recording a glitched example helps.

## Packages

| Package | Why |
| --- | --- |
| `@mediapipe/tasks-vision` | Google's pretrained hand-tracking model and its WebAssembly runtime (Apache-2.0). Runs locally, on the GPU when it can |
| `react`, `react-dom` | The page |
| `react-router-dom` | Modes and tabs are routes, e.g. `/spellbook/audio` |
| `vite`, `eslint` and plugins | Development server, build and lint (development only) |

Everything else comes from the browser: camera and microphone
(`getUserMedia`), drawing (canvas), sound (Web Audio), and recording and MP4
export (`MediaRecorder`, `canvas.captureStream`), plus Node's own file
functions in the dev server.

## Code layout

```
src/
  App.jsx              routes for the four modes
  modes/               each mode and its list of tabs
  tabs/                the tab screens (library, spellbook, record, finalize, edit)
  components/          header, tab bar, list/viewer/details layout, previews,
                       GestureRecorder, SpellPlayback, LiveCaster (camera,
                       casting, recording), FinalizePlayer (playback, export)
  tracking/            MediaPipe wrapper, camera loop hook, landmark helpers, skeleton drawing
  gestures/            features, DTW, trimming, the recogniser, detecting
                       spells in a recorded track
  effects/             coins, illumination, fireball, the sounds, WAV encoder,
                       audio engine, effect player
  library/             shared data (library, spells), accepted formats, loading
  record/              video recording (MediaRecorder, MP4 or WebM)
  storage/             projectApi.js talks to the dev server; db.js reads the
                       old browser database once, to move it into files
server/storage.js      dev-server routes that save spells, uploads, recordings,
                       exports
public/library/        the animation and sound entries and uploaded files, and
                       the spells
recordings/, exports/  your videos (git-ignored)
scripts/               MediaPipe setup, maths checks, spell generator
```

## Next steps

1. Editing: video and audio timeline, select a stretch, apply effects, find
   similar gestures, export.
2. The Animation Builder and Audio Lab.
