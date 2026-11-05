# Gesture Spellbook

Move your hand in front of the camera and turn the movement into a spell: a
burst of gold coins, a flash of light, a fireball, a clock winding down, a finger turning into a sprouting branch, with sound, drawn over the
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
| `npm run make-spells` | Creates any of the five spells whose file is missing, with generated examples; `npm run make-spells -- --regenerate` replaces the examples of all five with freshly generated ones (see "The spells") |
| `npm run tune` | Tries recogniser settings on the spells' examples and prints the best (see "Tuning the recogniser") |
| `npm run build` | Builds the app into `dist/` |
| `npm run lint` | Checks the code with ESLint |
| `npm run setup` | Puts the MediaPipe runtime and hand model into `public/` |

The port is fixed at 5173 on purpose. The browser keeps saved data per address,
so the app on another port would show an empty library.

## Quick start

The app comes with five spells ready to use, named *Gesture*-*Spell*:

| Spell | Gesture | Animation | Sound |
| --- | --- | --- | --- |
| **Pinch-Coins** | Press thumb and index fingertip together | Coins: spinning gold coins burst from the pinch | Spark-Chime |
| **Snap-Brightness** | Snap: middle finger off the thumb into the palm | Brightness: a point of light flares at the index fingertip and shines for about 3 s | Light-Swell |
| **Push-Fireball** | Fist, then fling the hand open and push it at the camera | Fireball: forms at the palm and rushes towards you | Fire-Crackle |
| **Finger-Slowdown** | From a fist, raise the middle finger on its own | Clock: a gothic clock above the fingertip, its hands spinning and slowing to a stop | Clock-Tick |
| **Index-Sprout** | From a fist, raise the index finger, thumb tucked in | Sprout: the finger turns into a branch that grows past the tip and opens into two leaves | Growth |

1. **Spellbook → Spellbook tab.** Select a spell and press **Play**. It loops
   through all of its examples until you press **Pause**, showing which
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
- Comes with: **Coins**, **Brightness**, **Fireball**, **Clock** and **Sprout**, all drawn by code.
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
- **Clock-Tick**: a clock ticking fast, then slowing tick by tick (each tick
  lower and longer, like a tape slowing down) over a low tone sliding down,
  ending with a soft low bell, 4.2 s. The ticks fall exactly when the Clock
  animation's second hand jumps (both use `src/effects/clockTiming.js`).
- **Growth**: wood creaking while the branch grows: four separate creaks,
  each a run of tiny stick-and-slip scrapes that starts slow (single ticks),
  speeds up and slows again, unevenly, ringing through the low resonances of
  wood with a deep groan, plus dry cracks (a quick cluster of clicks over a
  dull knock). Two soft creaks and a leafy rustle as the sprout opens. 3.6 s.

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
- Every spell can be edited and deleted, including the five that come with
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

The five that come with the app each have 10 examples generated by
`scripts/make-spells.js`, not recorded: five with the right hand and five
with the left, near the camera and far from it, quick and slow, a little
tilted (up to 35°) and turned to the side, with tracker-like jitter, and
always with the whole hand inside the picture.

- **Pinch-Coins**: the thumb tip and index fingertip close together, with
  the other fingers relaxed or held up straight (an "OK" sign).
- **Snap-Brightness**: the thumb presses on the middle fingertip, the middle
  finger slips off into the palm and the thumb shoots along the index
  finger, with a small jerk of the hand. Four of the ten are seen from the
  back of the hand, as when you snap with the palm towards yourself.
- **Push-Fireball**: a fist flung open and pushed towards the camera (the
  hand grows in the picture).
- **Finger-Slowdown**: the middle finger raised on its own, from a fist (or
  a loosely curled hand), the other fingers staying curled under the thumb.
  Six of the ten are seen from the back of the hand, the usual way to show
  it.
- **Index-Sprout**: the index finger raised on its own, pointing up, from a
  fist (or a loosely curled hand), with the thumb tucked in over the curled
  fingers rather than sticking out. Half are seen from the back of the hand.
  Its end looks a little like a snap's (index up, middle finger curled), so
  untick one of the two on the Record tab if they get mixed up.

How they are made: the hand is the average of real tracked open hands (so
it has a real hand's proportions as a camera sees it), its fingers are bent
into each pose, and each example gets slightly different finger lengths
and bends. Each 2.5 s "recording" then goes through the same trimming as
the in-app recorder.

`npm run make-spells` only creates spells whose file is missing.
`npm run make-spells -- --regenerate` replaces the examples of all five
(keeping their names, animations, sounds and sensitivity). You can also
record your own examples in the app; mixing recorded and generated ones is
fine.

## How animations work

Each animation that comes with the app is drawn by code on a canvas, every frame
(`src/effects/`). Each one appears at its own place on the hand:

| Animation | Appears at | How it is drawn |
| --- | --- | --- |
| Coins | between thumb and index tip | Ten coins thrown out with air drag and gravity, slowly spinning (drawn squashed sideways as they turn), fading out over about a second. The glowing coin is drawn once into a small image and stamped, which is far faster than drawing emoji text with a glow every frame |
| Brightness | the index fingertip, following it as it moves | A flash ring, a large warm halo, a white-hot core, two crossing light streaks and drifting specks, added together with additive blending so overlapping light goes towards white. Full brightness for about 2 s, then it fades out by about 3 s |
| Fireball | the palm | A ball (white-hot to yellow, orange and deep red) that grows and drifts towards the centre as it "comes at" the camera, throwing off flame particles that cool from yellow to red to smoke, then bursts into embers |
| Clock | just above the middle fingertip, following it | A dark glass face in a brass ring with Roman numerals turned towards the centre and 60 minute lines, gothic hands (spade tips, an open ring and a crossbar, a round counterweight) and a thin red second hand. The second hand jumps one numeral on every tick, fast at first, each gap 17% longer than the last, until it stops after about 3.4 s; the minute and hour hands glide along with it, blurred while fast. Cyan rings spread slowly from it, and it fades out by about 4.4 s. The face and hands are drawn once into images and only turned and stamped each frame |
| Sprout | along the whole index finger, following and bending with it | In stages: bark creeps up the finger from the knuckle to the tip (0.9 s), the branch grows on past the fingertip by half a finger's length, curving slightly (to 1.7 s), then a green shoot opens two leaves one after the other with a bud between them and specks of green light (to 3.3 s). It sways gently and fades out by about 5.2 s. The bark is an outline along the finger's joints with wood grain drawn inside it each frame: wavy light and dark streaks running along the wood that break off now and then, a few deeper furrows, three knots the grain bends around, an uneven edge and shading so it looks round. The pattern is fixed to the wood, so it doesn't slide as the branch grows. The leaf is drawn once into an image and stamped |

Uploaded video and image files appear centred on the pinch point.

## How sound plays

The sounds that come with the app are computed sample by sample in JavaScript when the app
opens and saved as WAV files, so they play in a normal audio player in the
Audio tab (`src/effects/sparkSound.js`, `src/effects/fireSound.js`,
`src/effects/lightSound.js`, `src/effects/clockSound.js`, `src/effects/growthSound.js`).

When a spell casts, its sound is played through the Web Audio API
(`src/effects/audioEngine.js`). Each sound is decoded once in advance and
kept in memory, so it starts within milliseconds of the cast. An `<audio>`
element would decode the file again each time, which adds a noticeable delay.

## The library

Every animation and sound is an entry in `public/library/animations/index.json`
or `public/library/audio/index.json`, so renaming, describing and deleting
them is saved into the project. They come from:

- **Made by code.** Coins, Brightness, Fireball, Clock and Sprout are drawn
  live. Spark-Chime, Light-Swell, Fire-Crackle, Clock-Tick and Growth are
  computed when the app opens.
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
     length and turned so the palm points straight up, so distance from the
     camera and tilt don't matter (×0.25: it depends a lot on whose hand it
     is)
   - the distance from the thumb tip to each fingertip (×2)
   - how bent each finger is: fingertip to wrist, divided by palm length,
     about 1 in a fist and 2 straight (×1)
   - how much bigger the hand looks than at the end, which is what tells a
     fireball push from just opening the hand (×8)
   - where the hand moves (×0, off: real hands wander while gesturing)

   Left hands are mirrored so either hand works. The tracker's left/right
   label is unreliable (it flickers, and is often wrong with the back of the
   hand to the camera), so a live movement is compared both ways, read as a
   right hand and as a left hand with one label throughout, and the closer
   reading counts. The movement is resampled
   to one step every 60 ms, so quick and slow gestures are compared at the
   same time resolution.
4. **Finding a live gesture** (`createLiveMatcher` in
   `src/gestures/recognizer.js`). The app watches how much the hand moves
   over the last 100 ms: the average of the five points that moved most, so
   a pinch, where only two fingers move, still counts. Measuring over 100 ms
   rather than one frame lets a gentle movement add up while the tracker's
   jitter doesn't. When the hand has
   been clearly moving and then settles, a gesture has just been completed.
   That is the moment it casts, with the animation where the hand is.
5. **Matching it.** The last few seconds of movement up to that moment are
   compared with every recorded example using *dynamic time warping*, which
   lines two movements up even when one is faster in places. The example
   may line up with any later part of those seconds, since the live stretch
   also holds whatever the hand did before, but both must end together.
   A term for how far apart the two final poses are is added, so a gesture
   that ends wrong (a snap undone instead of done) doesn't match. The live
   movement must also last at least 40% as long as the example (a gesture
   up to 2.5× faster still matches): otherwise the whole example could be
   squashed onto the last moment, and lowering a finger would match raising
   it. The spell of the closest example wins, if it is within that spell's limit and
   clearly closer than any other spell (under 0.7 × the next nearest, where
   the others are measured without the 40% rule, so anything the movement
   even vaguely resembles counts), so a movement halfway between two spells
   casts nothing.
6. **Each spell's limit** comes from its own examples: how close each one
   is to its nearest fellow example (90% of the way up that list, ×4, at
   most 5). Generated examples are more alike than real gestures, hence the
   generous ×4. A spell done in two styles still gets an honest limit,
   because each example is near the others of its own style. The spell's
   sensitivity then scales it.

The "last move" reading at the top of the Record tab's camera view shows,
after each movement, the nearest spell, how close the movement was and that
spell's limit (it cast if the first number is below the second), then the
next nearest spell. "too close to call" means it was within its limit but
the next spell was nearly as close, so nothing cast.

## Tuning the recogniser

`npm run tune` (`scripts/tune-recognizer.js`) replays every example as if
performed live (hold still, gesture, hold still) through the same live
matcher, to a recogniser that has never seen that example, and counts:
- correct casts (within 0.25 s of the gesture finishing)
- late casts
- wrong spells
- misses
- false alarms (a cast from the gesture played backwards, such as letting
  go of a pinch).

Starting from the current settings it changes one setting at a time, keeps
whatever scores better, and prints the best settings to copy into
`DEFAULT_SETTINGS` in `src/gestures/recognizer.js`.

The current settings were tuned on the generated examples and, at the same
time, checked against earlier real recordings of snaps and fireballs (kept
out of the spells): with all five spells ticked, 7 of 19 real snaps and all 6 real fireballs
cast, and none cast the wrong spell. Tuning on generated examples alone
would learn the generator's quirks, so real gestures are the better test.

## Checking the maths

`npm run check` tests, with no camera:

- dynamic time warping on small cases worked out by hand
- recording trimming, and things that must never cast on a synthetic hand
  (a still hand, a drifting hand, a wave, closing into a fist, a half pinch)
- every spell's examples replayed live through the same matcher as
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
| Every spell's examples, unseen: casting their own spell | 50 of 50 |
| The same with the other hand, with the left/right label misread, and mirrored with the label unchanged | 150 of 150 |
| Casting another spell | none |
| Played backwards: casting anything | none |
| A pinch by the check's own, differently shaped synthetic hand | casts Pinch-Coins (reported only) |
| Light-Swell | 3.30 s, peak 0.8, ends in silence; holds while the light shines, then fades |
| Spark-Chime | 1.80 s, peak 0.8, ends in silence; loudness falls 0.239 → 0.004 over 0.3 s steps |
| Fire-Crackle | 2.00 s, peak 0.85, ends in silence; crackle peaks 6.9× the average level; loudest at the burst, then dies away |
| Clock-Tick | 4.20 s, peak 0.8, ends in silence; 16 ticks, gaps growing 0.06 → 0.54 s; every tick at least 5.5× louder than the moment before it |
| Growth | 3.60 s, peak 0.8, ends in silence; creaking about 4× louder while the branch grows than as the leaves open; separate creaks with quiet gaps (no steady buzz) |

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
  effects/             coins, illumination, fireball, clock, sprout, the sounds, WAV encoder,
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
