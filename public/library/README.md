# Built-in library

Default animations and sounds that ship with the app. They show up in the
Animations and Audio tabs of both modes, next to any files uploaded in the
browser.

To add one, put the file in `animations/` or `audio/` and add an entry to that
folder's `index.json`:

```json
[
  {
    "id": "spark-burst",
    "name": "Spark burst",
    "file": "spark-burst.webm",
    "description": "Gold sparks bursting outwards"
  }
]
```

`id` must be unique and must not change, because spells refer to files by id.

## Spells

`spells/` holds packaged spells, one JSON file each, listed in
`spells/index.json`. A spell file has `id`, `name`, `description`,
`animationId`, `audioId`, `sensitivity` and `gesture.examples` (the recorded
hand landmarks). They appear in the Spellbook as read-only built-in spells.
