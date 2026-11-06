# Library

Every animation and sound the app offers, in both modes. Each is an entry in
`animations/index.json` or `audio/index.json`. An entry either names a
`file` in the same folder (an upload) or a `procedural` effect made by code
in `src/effects/` (Coins, Brightness, Fireball, Clock, Sprout; Spark-Chime,
Light-Swell, Fire-Crackle, Clock-Tick, Growth). An animation entry can also
have a `placement`: where it goes on the hand, set in the Animations tab
(see "Where an animation goes on the hand" in the main README and
`src/library/placement.js`). The app's Animations and Audio tabs upload, rename, describe
and delete them through the dev server.

To add one by hand, put the file in `animations/` or `audio/` and add an entry to that
folder's `index.json`:

```json
[
  {
    "id": "spark-burst",
    "name": "Spark burst",
    "file": "spark-burst.webm",
    "description": "Gold sparks bursting outwards",
    "placement": { "anchor": "pinch", "size": 3, "follow": true }
  }
]
```

`id` must be unique and must not change, because spells refer to files by id.

## Spells

`spells/` holds packaged spells, one JSON file each, listed in
`spells/index.json`. A spell file has `id`, `name`, `description`,
`animationId`, `audioId`, `sensitivity` and `gesture.examples` (the recorded
hand landmarks). They appear in the Spellbook as read-only built-in spells.
