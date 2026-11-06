# Gesture Spellbook

Move your hand in front of the camera and turn the movement into a spell,
drawn over the video with sound: a burst of gold coins, a flash of light, a
fireball, a clock winding down, a seedling sprouting from a fingertip,
bubbles floating up and popping.

The app runs in the browser (Edge or Chrome). Hand tracking uses a pretrained
model that runs on your own machine, so no video is sent anywhere. Gestures
are recognised by comparing your movement with a few examples, so no model
has to be trained.

## Running it

You need Node.js 20 or newer.

```
npm install
npm run dev
```

Then open http://localhost:5173 in Edge or Chrome and allow the camera (and
the microphone, for recording) when asked.

The dev server also saves and serves the app's files (`server/storage.js`):
spells into `public/library/spells/`, imported animations and sounds into
`public/library/animations/` and `public/library/audio/`, recordings into
`recordings/` and finished videos into `exports/`. A browser page can't write
files by itself, so editing, importing and recording only work while
`npm run dev` is running. Without it, spells load read-only.

`npm install` also runs `npm run setup`, which copies the MediaPipe runtime
into `public/mediapipe/` and downloads the hand model (about 8 MB) into
`public/models/`. Both folders are git-ignored. Run `npm run setup` again if
either goes missing.

| Command | What it does |
| --- | --- |
| `npm run dev` | Serves the app at http://localhost:5173 |
| `npm run check` | Checks the gesture maths, the spells and the sounds made by code, without a camera (see "Checking the maths") |
| `npm run make-spells` | Creates any of the five generated spells whose file is missing; `npm run make-spells -- --regenerate` replaces their examples with freshly generated ones (see "The spells") |
| `npm run tune` | Tries recogniser settings on the spells' examples and prints the best (see "Tuning the recogniser") |
| `npm run build` | Builds the app into `dist/` |
| `npm run lint` | Checks the code with ESLint |
| `npm run setup` | Puts the MediaPipe runtime and hand model into `public/` |

The port is fixed at 5173 on purpose: the browser keeps its data per
address, and the first time the app opens it moves anything earlier versions
left in the browser's database into files. On another port it wouldn't find
that data.

After pulling changes or editing code, reload any open tab of the app. An
old tab keeps running the old code, and saving a setting there can overwrite
newer settings.

## Quick start

The app comes with six spells, named *Gesture*-*Spell*:

| Spell | Gesture | Animation | Sound |
| --- | --- | --- | --- |
| **Pinch-Coins** | Press thumb and index fingertip together | Coins | Spark-Chime |
| **Snap-Brightness** | Snap: middle finger off the thumb into the palm | Brightness | Light-Swell |
| **Push-Fireball** | Fist, then fling the hand open and push it at the camera | Fireball | Fire-Crackle |
| **Finger-Slowdown** | From a fist, raise the middle finger on its own | Clock | Clock-Tick |
| **Index-Sprout** | From a fist, raise the index finger, thumb tucked in | Sprout | Growth |
| **Index-Bubble** | The same as Index-Sprout (a copy of its gesture) | Bubble (an imported file) | Bubble Pop (an imported file) |

Index-Bubble shares Index-Sprout's gesture: tick only one of the two on the
Record tab, or neither can win.

1. **Spellbook → Spellbook tab.** Select a spell and press **Play**. It loops
   through all of its examples until you press **Pause**, showing which
   example is playing. Each one plays the hand, then the animation and sound
   together at the moment the spell would cast.
2. **Record tab.** Press **Start camera** and do one of the gestures, then
   hold your hand still for a moment: a spell casts when the hand settles.
   The spell's name flashes, its animation appears on your hand and its
   sound plays. Press **● Start recording** to record a video while you cast.
3. **Finalize tab.** Pick the recording. It plays back with the spells'
   animations and sounds added where you cast them. Press **Export video**
   for a finished MP4 to download.

You can start a gesture from any hand position: only the way it ends has to
match. Either hand works.

If a spell never casts, or casts by accident, change its **Sensitivity**
(higher casts more easily), or untick spells you aren't using on the Record
tab. The **last move** reading at the top of the Record tab's camera view
says, after each movement, which spell was nearest, how near (first number)
and that spell's limit (second number), then the next nearest spell. It casts
when the first number is below the second. "too close to call" means it was
within the limit but another spell was nearly as close, so nothing cast.

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
- List: every animation (see "The animations"). The green + uploads (imports) a file.
- Viewer: plays the selected animation on a loop (silently: sound always
  comes from audio files).
- Details:
  - the name (editable)
  - **Position on the hand**: a dropdown of 15 places
  - its size, and **Follows the hand**
  - source, format, size and date, and an editable description
  - an **Upload** button, and **Delete** at the bottom

  Where an animation goes on the hand is set only here (see "Where an
  animation goes on the hand").
- An animation a spell uses can't be deleted: a message in the centre of the
  screen names the spells that use it. Choose another animation for those
  spells first.

**Audio.** The audio library, shared with Editing mode, laid out the same way,
with the same renaming, deleting and in-use protection. The viewer is an
audio player. See "The sounds" for what it holds.

**Spellbook.** Spells. A spell joins three separate things: a gesture, an
animation and a sound from the library.
- List: every spell. The green + makes a new one.
- Viewer: one **Play / Pause** button plays the whole spell, looping through
  its examples (shown as "Example 2 of 10") until paused:
  - the gesture, as a moving hand skeleton
  - at the moment it would cast (when the hand arrives at its final pose),
    the animation and the sound together, at the animation's place on the
    hand

  Nothing is cut short: each example plays until its longest part has
  finished. Pause freezes all of it. Parts the spell doesn't have are
  skipped. Markers along the top show which parts are set.
- Details:
  - name and description
  - **Record gesture / Add examples**, and **Clear**
  - sensitivity
  - the animation and sound pickers
  - when it was made and recorded
  - **Make a copy** and **Delete spell**
- Every spell can be edited, copied and deleted, including the six that come
  with the app. Each is a file in the repository (see "The spells"), so
  changes, new spells and deletions go to GitHub with your next push.
- Recording a gesture turns the viewer into the camera. Each recording is
  trimmed to the part where your hand moved.

**Record.** Live casting and recording.
- Left column, split in half:
  - **Recordings** (top). **● New recording** (or the green +) connects to
    the camera. Selecting a saved recording plays it back instead, with its
    spells' animations and sounds.
  - **Spells to recognise** (bottom), for a new recording: tick boxes with a
    green tick to the left of each spell's name, plus All and None. Untick a
    spell so it can't fire by mistake, for example Index-Sprout while you
    snap, or one of two spells that share a gesture. The choice is saved
    with the recording and can't be changed afterwards, so this half is
    empty when a saved recording is selected. Spells without a gesture can't
    be ticked.
- Viewer, for a new recording: the camera. Recognition and animations work
  whether or not you are recording. When a ticked spell's gesture is
  recognised, its name flashes, its animation appears on your hand and its
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
  animation on the hand and its sound, at the moment it was cast.
  Animations set to follow the hand follow the recorded hand. **Play /
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
animation and/or sound to only that stretch or to every similar gesture in
the video.
- List: your recordings.
- Viewer: the open video.
- Timeline: a video track and an audio track.
- Details: "only the selected part" or "every similar gesture", plus the
  animation and sound pickers.

The controls are in place, but selecting and applying are coming soon.

### Animation Builder and Audio Lab *(coming soon)*

Designing animations from particles and shapes, and generating sounds by
layering waves. Whatever they make will be saved to the shared library.

## The animations

Every name can be changed in the Animations tab; these are the current ones.
The **Position** column is where each appears unless you change it.

| Animation | Made by | Position | Follows the hand | What it is |
| --- | --- | --- | --- | --- |
| **Coins** | code (`src/effects/coins.js`) | between thumb and index (pinch) | can't: bursts out from where it's cast | Ten spinning gold coins thrown out with air drag and gravity, fading over about a second |
| **Brightness** | code (`src/effects/illumination.js`) | top of the index finger | yes | A point of warm white light with a flash ring, halo and crossing streaks; full for about 2 s, gone by about 3 s |
| **Fireball** | code (`src/effects/fireball.js`) | centre of the palm | can't: rushes at the camera from where it's cast | A ball of fire that grows as it comes at the camera, throwing off flames, then bursts into embers (about 2 s) |
| **Clock** | code (`src/effects/clock.js`) | top of the middle finger (it sits just above) | yes | A gothic clock with Roman numerals and brass hands that spin fast, then slow tick by tick to a stop; fades by about 4.4 s |
| **Sprout** | code (`src/effects/sprout.js`) | top of the index finger | yes | A short wooden branch with wood grain grows out of the fingertip, then a green stem, then two leaves unfurl; fades by about 5.2 s |
| **Bubble** | an imported file (`public/library/animations/index-bubble.png`, an animated PNG) | top of the index finger, 4 palm lengths tall | yes | Pink bubbles of random sizes are blown out of the fingertip, float up and pop (3.3 s) |

How the ones made by code are drawn:

- **Coins**: the glowing coin is drawn once into a small image and stamped,
  squashed sideways as it spins, which is far faster than drawing an emoji
  with a glow every frame.
- **Brightness**: the layers are added together with additive blending, so
  overlapping light goes towards white.
- **Fireball**: flame particles cool from yellow to red to smoke.
- **Clock**: the second hand jumps one numeral on every tick, each gap 17%
  longer than the last; the minute and hour hands glide along, blurred while
  fast; cyan rings spread slowly from it. The face and hands are drawn once
  into images and only turned and stamped each frame. Its ticks line up with
  the Clock-Tick sound (both use `src/effects/clockTiming.js`).
- **Sprout**: the wood grows while the Growth sound creaks (to 1.7 s), the
  stem to 2.1 s, the leaves unfurl to 3.3 s. The wood is an outline with
  grain drawn inside it each frame: wavy light and dark streaks along it,
  deeper furrows, knots the grain bends around, an uneven edge and shading
  so it looks round. It grows along whichever finger it's placed on.

All are kept cheap per frame (images drawn once and stamped, no blur effects
per particle), so the camera view stays smooth.

## Where an animation goes on the hand

An animation on its own doesn't know where it belongs on the hand: coins
burst from a pinch, bubbles rise from a fingertip. Only a spell joins an
animation to a gesture, so each animation keeps a **placement**, set in the
Animations tab and saved with it in `public/library/animations/index.json`
(`src/library/placement.js`). Imported files carry no position information
of their own.

### Position on the hand

A dropdown of 15 places:

| Group | Positions |
| --- | --- |
| Top of a finger | thumb, index, middle, ring, little finger |
| Slightly lower on a finger (its last joint) | thumb, index, middle, ring, little finger |
| Between two fingertips | thumb and index (pinch), index and middle, middle and ring, ring and little finger |
| Palm | centre of the palm (where an imported file starts) |

### Size

- **An imported file**: its height in palm lengths (from the wrist to the
  base of the middle finger), so it scales with the hand: bigger when the
  hand is near the camera, smaller when far. 3 to 5 suits most effects.
- **One made by code**: a multiplier on its designed size (×1 as designed,
  ×2 twice as big).

### Follows the hand

Ticked, the animation moves with that point while it plays; unticked, it
stays where the spell was cast. Coins and Fireball always stay: they burst
out from where they're cast. Sprout grows along the finger it's on; placed
between fingers or on the palm, it grows straight up from the point.

### Drawing an animation to import

Which point of the picture lands on the hand depends on the position type:

| Position type | The point of the picture placed on the hand | So draw it |
| --- | --- | --- |
| Top of a finger, or slightly lower on one | the middle of its **bottom edge** | coming out of the middle of the bottom edge and rising or growing upwards (bubbles, a plant, flames, a beam) |
| Between two fingertips | its **centre** | centred, spreading out from the middle (a burst, sparks, a spinning sigil) |
| Centre of the palm | its **centre** | centred (an orb, a shield, a ring) |

For every type:
- use a **see-through background**, so the camera shows around it
- leave a little empty margin, so nothing is cut off at the edges
- make it play once, from start to end: the app plays it once from the
  first frame each time the spell casts, and its length is the file's own
- a portrait picture (taller than wide) suits finger effects, a square one
  suits palm and between-finger effects; the app keeps the picture's shape
  and sets its height from the Size setting

The Bubble animation was made this way: 200 × 400 pixels, the bubbles
blown out of the middle of the bottom edge.

### Supported file types

Animations:

| Type | See-through background | How it plays | Notes |
| --- | --- | --- | --- |
| **Animated PNG** (`.png`, `.apng`) | yes, with soft edges | once, frame by frame, at the file's own timing | recommended; Bubble is one; the only type tested with a real file |
| **Animated WebP** (`.webp`) | yes, with soft edges | the same | recommended; usually much smaller than PNG |
| **GIF** (`.gif`) | only fully clear or fully solid, so edges look jagged; 256 colours | the same | works, but looks rougher over video |
| **WebM video** (`.webm`) | yes, if exported with transparency (VP9 with alpha) | once, to its end | good for long or large animations |
| **MP4 video** (`.mp4`) | no: it covers the camera with a solid rectangle | once, to its end | only for full-frame effects |
| **Still PNG** | yes | shows for 1.5 s, then fades | for a simple image |
| **Lottie** (`.json`) | — | not drawn yet | can be imported and assigned, but nothing shows |

Animated images are decoded frame by frame with the browser's ImageDecoder
(`src/effects/animatedImage.js`), so they always start from their first
frame, pause with everything else, and end when the file ends. They are
decoded once and kept in memory; the animations of the spells you can cast
are decoded in advance, so they start the instant a spell casts.

Sounds: **MP3, WAV, OGG, Opus, M4A / AAC, FLAC, WebM audio**. A sound plays
once from its start when the spell casts, together with the animation, so
put the important part (a pop, a chime) at the very start of the file, or
time it to the animation.

### Importing, step by step

1. **Animations tab**: press the green + and choose the file. Rename it if
   you like.
2. In its details, choose its **Position on the hand**, its **Height** and
   whether it **Follows the hand**.
3. **Audio tab**: press the green + and choose the sound.
4. **Spellbook tab**: select a spell (or make one, or **Make a copy** of one
   whose gesture you want) and choose the animation and sound. Press
   **Play** to see it on the examples.
5. **Record tab**: tick the spell. If it shares a gesture with another
   spell, untick the other.

Gestures aren't imported: a spell's gesture is recorded in the app (or
generated, for the ones that come with it).

Imported files are copied into `public/library/animations/` or
`public/library/audio/` with a tidied file name (`My Sound (1).WAV` becomes
`my-sound-1.wav`) and listed in that folder's `index.json`, so they are
committed with your next push. The dev server serves them straight from
there, so an import shows at once.

## The sounds

| Sound | Made by | What it is |
| --- | --- | --- |
| **Spark-Chime** | code (`src/effects/sparkSound.js`) | A bright strike, then a rippling bell chime with a shimmer and an echo, fading out (1.8 s) |
| **Light-Swell** | code (`src/effects/lightSound.js`) | A glassy ping as the light flares, then a warm chord that swells and holds while it shines, with an airy shimmer and twinkles, fading with the light (3.3 s) |
| **Fire-Crackle** | code (`src/effects/fireSound.js`) | A whoosh and roar with crackles and pops, building for 0.9 s like the fireball, then dying away (2 s) |
| **Clock-Tick** | code (`src/effects/clockSound.js`) | A clock ticking fast, then slowing tick by tick, each tick lower and longer, over a low tone sliding down, ending with a soft bell (4.2 s); the ticks match the Clock's second hand |
| **Growth** | code (`src/effects/growthSound.js`) | Wood creaking as the branch grows: separate creaks of uneven stick-and-slip scrapes (slow, faster, slow) with a deep groan and dry cracks, then soft creaks and a leafy rustle as the sprout opens (3.6 s) |
| **Bubble Pop** | an imported file (`public/library/audio/bubble-pop.wav`) | A soft "bloop" as each bubble is blown and a pop as each bursts, timed to the Bubble animation (3.6 s) |

The sounds made by code are computed sample by sample in JavaScript when the
app opens and kept as WAV files, so they play in the Audio tab's player like
any other sound.

When a spell casts, its sound plays through the Web Audio API
(`src/effects/audioEngine.js`). Each sound is decoded once in advance and
kept in memory, so it starts within milliseconds of the cast. An `<audio>`
element would decode the file again each time, which adds a noticeable delay.

## The library

Every animation and sound is an entry in `public/library/animations/index.json`
or `public/library/audio/index.json`, so renaming, describing, placing and
deleting them is saved into the project. An entry either has a `procedural`
name (made by code in `src/effects/`) or a `file` in the same folder (an
import). A deleted one made by code can be brought back by restoring its
entry from git. See `public/library/README.md` for the entry format.

## Where things are saved

| What | Where | In git? |
| --- | --- | --- |
| Spells, with their gestures | `public/library/spells/` (one JSON file each) | Yes: committed with your next push |
| Animations and sounds (entries, placements, imported files) | `public/library/animations/` and `public/library/audio/` | Yes: committed with your next push |
| Recordings | `recordings/<id>/` (video, hand track, details) | No: git-ignored, stays on this computer |
| Exported videos | `exports/` | No: git-ignored |

Everything is a plain file in the project folder; there is no database.
The files are written by the dev server, because a web page can't write
files on your computer by itself. The page sends them to `npm run dev`,
which saves them (`server/storage.js`).

Earlier versions kept spells and uploads in the browser's database; the app
moves anything it finds there into files the first time it opens.

`.gitignore` excludes `recordings/`, `exports/` and any video files saved
elsewhere in the project (`.webm`, `.mp4`, `.mov`, `.mkv`), except in
`public/library/`, so imported video animations are committed.

## The spells

Every spell is a JSON file in `public/library/spells/`, listed in its
`index.json`, so spells are part of the repository: a spell you make, edit
or delete in the app is committed with your next push. A spell holds its
name, description, animation, sound, sensitivity and its gesture examples:
hand positions only (21 points per hand per frame), no video. New spells get
a file named after them, such as `my-spell-x7k2.json`; renaming a spell later
keeps its file name.

Five spells have 10 examples each generated by `scripts/make-spells.js`, not
recorded: five with the right hand and five with the left, near the camera
and far from it, quick and slow, tilted up to 35° and turned to the side,
with tracker-like jitter, and always with the whole hand inside the picture.

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
  it. Keep the thumb tucked: with it sticking out, it may not cast.
- **Index-Sprout**: the index finger raised on its own, pointing up, from a
  fist (or a loosely curled hand), with the thumb tucked in over the curled
  fingers rather than sticking out. Half are seen from the back of the hand.
  Its end looks a little like a snap's (index up, middle finger curled), so
  untick one of the two on the Record tab if they get mixed up.

**Index-Bubble** is a copy of Index-Sprout's examples (not generated
separately), made for trying out imported animations and sounds.

How the examples are made: the hand is the average of real tracked open
hands (so it has a real hand's proportions as a camera sees it), its fingers
are bent into each pose, and each example gets slightly different finger
lengths and bends. Each 2.5 s "recording" then goes through the same
trimming as the in-app recorder.

`npm run make-spells` only creates spells whose file is missing.
`npm run make-spells -- --regenerate` replaces the examples of the five
generated spells (keeping their names, animations, sounds and sensitivity).
You can also record your own examples in the app; mixing recorded and
generated ones is fine.

## How gestures are recognised

1. **Hand tracking (pretrained model).** MediaPipe's Hand Landmarker finds
   up to two hands in each camera frame and gives 21 points per hand: the
   wrist, each knuckle and each fingertip. The app follows the first hand it
   reports, so keep your other hand out of view while casting.
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
   right hand and as a left hand, and the closer reading counts. A mirrored
   webcam makes no difference. The movement is resampled to one step every
   60 ms, so quick and slow gestures are compared at the same time
   resolution.
4. **Finding a live gesture** (`createLiveMatcher` in
   `src/gestures/recognizer.js`). The app watches how much the hand moves
   over the last 100 ms: the average of the five points that moved most, so
   a pinch, where only two fingers move, still counts. Measuring over 100 ms
   rather than one frame lets a gentle movement add up while the tracker's
   jitter doesn't. When the hand has been clearly moving and then settles, a
   gesture has just been completed. That is the moment it casts, with the
   animation where the hand is.
5. **Matching it.** The last few seconds of movement up to that moment are
   compared with every example using *dynamic time warping*, which lines two
   movements up even when one is faster in places. The example may line up
   with any later part of those seconds, since the live stretch also holds
   whatever the hand did before, but both must end together. A term for how
   far apart the two final poses are is added, so a gesture that ends wrong
   (a snap undone instead of done) doesn't match. The live movement must
   also last at least 40% as long as the example (a gesture up to 2.5×
   faster still matches): otherwise the whole example could be squashed onto
   the last moment, and lowering a finger would match raising it. The spell
   of the closest example wins, if it is within that spell's limit and
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

Spells that share a gesture are tested without their twin, as they're
never ticked together. Starting from the current settings it changes one
setting at a time, keeps whatever scores better, and prints the best
settings to copy into `DEFAULT_SETTINGS` in `src/gestures/recognizer.js`.

The current settings were tuned on the generated examples and, at the same
time, checked against earlier real recordings of snaps and fireballs (kept
out of the spells): with all the spells ticked, 7 of 19 real snaps and all
6 real fireballs cast, and none cast the wrong spell. Tuning on generated
examples alone would learn the generator's quirks, so real gestures are the
better test.

## Checking the maths

`npm run check` tests, with no camera:

- dynamic time warping on small cases worked out by hand
- recording trimming, and things that must never cast on a synthetic hand
  (a still hand, a drifting hand, a wave, closing into a fist, a half pinch)
- every spell's examples replayed live through the same matcher as the app,
  each to a recogniser that has never seen it, also as the other hand, with
  the left/right label misread, and mirrored. Strict checks: no example
  casts another spell, nothing played backwards casts, and at least 80% of
  examples cast their own spell. Misses are listed.
- the sounds made by code.

Current results:

| Test | Result |
| --- | --- |
| DTW on small hand-worked cases | exact |
| Synthetic pinch recordings, trimmed from 2.5 s | to 0.40 s |
| Still hand, drifting hand, waving, half pinch, closing into a fist | no cast |
| Every spell's examples, unseen: casting their own spell | 60 of 60 |
| The same with the other hand, with the left/right label misread, and mirrored with the label unchanged | 180 of 180 |
| Casting another spell | none |
| Played backwards: casting anything | none |
| A pinch by the check's own, differently shaped synthetic hand | casts Pinch-Coins (reported only) |
| Spark-Chime | 1.80 s, peak 0.8, ends in silence; loudness falls 0.239 → 0.004 over 0.3 s steps |
| Light-Swell | 3.30 s, peak 0.8, ends in silence; holds while the light shines, then fades |
| Fire-Crackle | 2.00 s, peak 0.85, ends in silence; crackle peaks 6.9× the average level; loudest at the burst, then dies away |
| Clock-Tick | 4.20 s, peak 0.8, ends in silence; 16 ticks, gaps growing 0.06 → 0.54 s; every tick at least 5.5× louder than the moment before it |
| Growth | 3.60 s, peak 0.8, ends in silence; creaking about 4× louder while the branch grows than as the leaves open; separate creaks with quiet gaps (no steady buzz) |

What `npm run check` can't test: the camera, real tracking, how animations
look and how sounds sound. Those need a try in the browser.

## Packages

| Package | Why |
| --- | --- |
| `@mediapipe/tasks-vision` | Google's pretrained hand-tracking model and its WebAssembly runtime (Apache-2.0). Runs locally, on the GPU when it can |
| `react`, `react-dom` | The page |
| `react-router-dom` | Modes and tabs are routes, e.g. `/spellbook/audio` |
| `vite`, `eslint` and plugins | Development server, build and lint (development only) |

Everything else comes from the browser: camera and microphone
(`getUserMedia`), drawing (canvas), sound (Web Audio), animated images
(ImageDecoder), and recording and MP4 export (`MediaRecorder`,
`canvas.captureStream`), plus Node's own file functions in the dev server.

## Code layout

```
src/
  App.jsx              routes for the four modes
  modes/               each mode and its list of tabs
  tabs/                the tab screens (library, spellbook, record, finalize, edit)
  components/          header, tab bar, list/viewer/details layout, previews,
                       GestureRecorder, SpellPlayback, LiveCaster (camera,
                       casting, recording), FinalizePlayer (playback, export)
  tracking/            MediaPipe wrapper, camera loop hook, landmark helpers
                       (the 15 hand positions), skeleton drawing
  gestures/            features, DTW, trimming, the recogniser, detecting
                       spells in a recorded track
  effects/             the animations and sounds made by code, the effect
                       player, animated-image decoding, audio engine, WAV encoder
  library/             shared data (library, spells), placements, accepted
                       formats, loading
  record/              video recording (MediaRecorder, MP4 or WebM)
  storage/             projectApi.js talks to the dev server; db.js reads the
                       old browser database once, to move it into files
server/storage.js      dev-server routes that save spells, imports, recordings
                       and exports, and serve imported files
public/library/        the animation and sound entries, imported files, and
                       the spells
recordings/, exports/  your videos (git-ignored)
scripts/               MediaPipe setup, maths checks, spell generator, tuner
```

## Next steps

1. Editing: video and audio timeline, select a stretch, apply effects, find
   similar gestures, export.
2. The Animation Builder and Audio Lab.
3. Drawing Lottie animations.
