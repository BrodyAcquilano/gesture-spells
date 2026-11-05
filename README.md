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

## Quick start: your first spell (a pinch)

1. **Spellbook → Spellbook tab.** Press the green **+** to make a spell and
   type a name, for example "Spark".
2. Record 3 to 5 examples of a pinch, following
   [Recording a gesture](#recording-a-gesture) below.
3. In the details below the viewer, choose **Sparks ✨** as the animation
   and **Spark chime** as the audio. The viewer now replays your recorded
   pinch with the sparks where it ends, and the chime has its own player.
4. **Record tab.** Press **Start camera** and pinch. The spell's name
   flashes, sparks burst from your fingers and the chime plays.

## Recording a gesture

A gesture is recorded as hand positions only: 21 points per hand per frame.
No video or picture of you is kept (see "Where things are saved").

### Steps

1. In **Spellbook → Spellbook**, select the spell and press **Record gesture**
   (or **Add examples** if it already has some). The viewer turns into the
   camera.
2. Press **Start camera** and allow the camera if Edge asks. A cyan skeleton
   should appear over your hand. If it doesn't, move your hand fully into
   view.
3. Press **Record example**. A 3-second countdown starts.
4. During the countdown, **hold still** in the gesture's starting position.
5. At **GO**, do the gesture **once**. The skeleton turns gold and a gold bar
   fills along the bottom (2.5 seconds).
6. When the bar finishes, the recording is cut down to the part where your
   hand moved and saved as one example. A message shows how long the movement
   was, or what went wrong.
7. Press **Record another** until you have 3 to 5 examples, then **Done**.

### For a pinch

- Sit about an arm's length from the camera, in good light, with your whole
  hand in view and your palm facing the camera.
- Start with your hand **open**, fingers relaxed and slightly apart.
- At GO, bring your **thumb tip and index fingertip firmly together**,
  quickly, so they clearly touch.
- **Keep holding the pinch** until the gold bar finishes. Don't open your
  hand again. The spell casts the moment the pinch closes, so the recording
  should end closed.
- Use the hand you will cast with. Either hand works, because left hands are
  mirrored to match right hands.

### Tips for any gesture

- **Start and end still.** The recorder finds the gesture by looking for
  where your hand leaves its starting pose and settles into its final one.
- **Vary the examples a little**: one a bit faster, one slower, one nearer
  the camera, one further. The spell's limit for casting comes from how much
  your examples differ, so a little variety makes it forgiving enough for
  real use. Wildly different examples make it accept almost anything.
- **Keep the whole hand in view.** If the hand is lost for much of the
  recording, it is rejected.
- **"No movement was seen"** means the hand barely moved. Make the gesture
  bigger or clearer.
- A bad example can't be deleted on its own yet. Use **Clear** and record
  the set again.

### Tuning

After recording, try the spell in the **Record** tab. The **closest** reading
at the top shows how near your movement is to a spell, as two numbers. It
casts when the first drops below the second.

- **Never casts:** raise the spell's **Sensitivity** in the Spellbook
  details, or record more examples.
- **Casts by accident:** lower the sensitivity.

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

**Spellbook.** Your spells. A spell joins three separate things: a gesture
you record, an animation and an audio file from the library.
- List: your spells, with how many gesture examples each has. The green +
  makes a new spell.
- Viewer: whatever the spell has so far.
  - Gesture: your recorded examples replay as a moving hand skeleton, one
    after another.
  - Animation: plays where the gesture ends, as it will when cast live. With
    no gesture, the animation plays on its own.
  - Audio: an audio player underneath.
  - Markers along the top show which of gesture, animation and audio are set.
- Details:
  - name and description
  - **Record gesture / Add examples**, and **Clear**
  - sensitivity
  - the animation and audio pickers
  - when it was made and recorded
- Recording a gesture turns the viewer into the camera (see the quick start).
  Each recording is trimmed to the part where your hand moved.

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

Spells (with their recorded gestures) and uploaded files are saved in the
browser's IndexedDB database for this site. They are still there next time
the app is opened, in the same browser at the same address. The app asks the
browser to keep the data even when disk space runs low. An export/import
backup file is planned.

None of this is in the project folder, so recorded gestures and uploads never
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

`npm run check` tests the recogniser on synthetic hands (no camera) and the
spark chime. Current results:

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
| Spark chime | 1.80 s, peak 0.8, ends in silence, loudness falls 0.215 → 0.007 after the bells peak |

Synthetic hands are tidier than real ones, so real-camera thresholds may need
the sensitivity slider.

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
                       GestureRecorder, GesturePlayback, LiveCaster
  tracking/            MediaPipe wrapper, camera loop hook, landmark helpers, skeleton drawing
  gestures/            features, DTW, trimming, the recogniser
  effects/             sparks particles, spark chime synthesis, WAV encoder, effect player
  library/             shared data (library files, spells), accepted formats, built-ins
  storage/db.js        small IndexedDB wrapper
public/library/        built-in animation and audio files
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
