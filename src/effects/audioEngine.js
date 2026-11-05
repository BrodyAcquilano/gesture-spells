// Plays sounds with the Web Audio API so they start the instant a spell is
// cast.
//
// An <audio> element has to load and decode its file each time it plays,
// which adds a noticeable delay. Here each sound file is decoded once into an
// AudioBuffer (the raw samples in memory) and kept; playing it is then just
// starting a buffer source, which begins within a few milliseconds.
//
// The browser only lets a page make sound after the person has clicked or
// pressed something, so the AudioContext is resumed on each play (which always
// follows a click: Play, or Start camera).

let context = null
const buffers = new Map() // url -> Promise<AudioBuffer>
let extraOutput = null // also send sounds here (an export's recording), if set

// While exporting a video, effect sounds go to the export as well as the
// speakers. Pass null to stop.
export function setExtraOutput(node) {
  extraOutput = node
}

export function audioContext() {
  context ??= new AudioContext()
  return context
}

// Starts fetching and decoding a sound so it is ready before it is needed.
export function preloadSound(url) {
  if (!url) return null
  if (!buffers.has(url)) {
    const decoded = fetch(url)
      .then((response) => response.arrayBuffer())
      .then((data) => audioContext().decodeAudioData(data))
    decoded.catch(() => buffers.delete(url))
    buffers.set(url, decoded)
  }
  return buffers.get(url)
}

// Plays a sound. Returns a handle: { stop(), onEnd(callback) }.
export function playSound(url) {
  const ctx = audioContext()
  if (ctx.state === 'suspended') ctx.resume()
  let source = null
  let stopped = false
  let ended = false
  let endCallback = () => {}
  const finish = () => {
    if (ended) return
    ended = true
    endCallback()
  }
  preloadSound(url)
    ?.then((buffer) => {
      if (stopped) return finish()
      source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(ctx.destination)
      if (extraOutput) source.connect(extraOutput)
      source.onended = finish
      source.start()
    })
    .catch(finish)
  return {
    stop() {
      stopped = true
      try {
        source?.stop()
      } catch {
        // already stopped
      }
      finish()
    },
    onEnd(callback) {
      endCallback = callback
      if (ended) callback()
    },
  }
}

// Pause and resume every sound at once (used by the spellbook's Pause).
export function pauseAllSounds() {
  context?.suspend()
}
export function resumeAllSounds() {
  context?.resume()
}
