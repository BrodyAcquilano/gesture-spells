// Records a MediaStream (camera, canvas, microphone…) into a video file with
// the browser's built-in MediaRecorder. No package needed.
//
// MP4 (H.264 video, AAC audio) is preferred because it plays everywhere;
// Edge and Chrome can record it directly. Where they can't, WebM is used.

const TYPES = [
  ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'mp4'],
  ['video/mp4;codecs=avc1,mp4a', 'mp4'],
  ['video/mp4', 'mp4'],
  ['video/webm;codecs=vp9,opus', 'webm'],
  ['video/webm;codecs=vp8,opus', 'webm'],
  ['video/webm', 'webm'],
]

export function pickVideoType() {
  for (const [mimeType, ext] of TYPES) {
    if (MediaRecorder.isTypeSupported(mimeType)) return { mimeType, ext }
  }
  return { mimeType: '', ext: 'webm' }
}

// Starts recording. Returns { startedAt, stop() }:
//   startedAt  performance.now() when recording actually began, so the times
//              of things that happen during it can be measured from there
//   stop()     resolves to { blob, mimeType, ext, duration } (seconds)
export function startRecording(stream, { videoBitsPerSecond = 6_000_000 } = {}) {
  const { mimeType, ext } = pickVideoType()
  const recorder = new MediaRecorder(stream, { ...(mimeType && { mimeType }), videoBitsPerSecond })
  const chunks = []
  const handle = { startedAt: performance.now(), ext, mimeType: recorder.mimeType || mimeType }
  recorder.addEventListener('start', () => (handle.startedAt = performance.now()))
  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size) chunks.push(event.data)
  })
  const finished = new Promise((resolve, reject) => {
    recorder.addEventListener('stop', () => {
      const type = (handle.mimeType || `video/${ext}`).split(';')[0]
      resolve({
        blob: new Blob(chunks, { type }),
        mimeType: type,
        ext,
        duration: (performance.now() - handle.startedAt) / 1000,
      })
    })
    recorder.addEventListener('error', (event) => reject(event.error ?? new Error('Recording failed')))
  })
  recorder.start(1000) // hand over data every second, so nothing is lost
  handle.stop = () => {
    if (recorder.state !== 'inactive') recorder.stop()
    return finished
  }
  return handle
}

// A name for a recording's folder or an exported file: lower-case letters,
// digits and dashes, from the date and time.
export function timestampId(prefix) {
  const stamp = new Date().toISOString().slice(0, 19).toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return `${prefix}-${stamp}-${Math.random().toString(36).slice(2, 6)}`
}
