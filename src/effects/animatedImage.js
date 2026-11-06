// Decodes an image file (animated PNG, GIF, animated WebP, or a still PNG)
// into its frames and how long each shows, so the effect player can start it
// from its first frame on every cast, pause it, and know when it ends. An
// <img> can't do that: it runs its own clock and loops.
//
// Uses the browser's ImageDecoder (part of WebCodecs, in Edge and Chrome).
// Without it, the image is shown as a single still frame.
//
// loadAnimatedImage(url) → Promise<{ frames: [{ image, start, end }],
//   duration (s, or null for a still image), width, height }>, decoded once
// per file and kept.

const cache = new Map() // url → Promise of the decoded image
const decodedAlready = new Map() // url → the decoded image, once ready

const TYPES = { png: 'image/png', apng: 'image/png', gif: 'image/gif', webp: 'image/webp' }
const DEFAULT_FRAME_SECONDS = 0.1 // for frames that don't say how long they show

async function decode(url) {
  const extension = url.split('?')[0].split('.').pop().toLowerCase()
  const type = TYPES[extension] ?? 'image/png'
  if (typeof ImageDecoder !== 'undefined' && (await ImageDecoder.isTypeSupported(type))) {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Could not load ${url}`)
    const decoder = new ImageDecoder({ data: await response.arrayBuffer(), type })
    await decoder.tracks.ready
    await decoder.completed
    const count = decoder.tracks.selectedTrack.frameCount
    const frames = []
    let time = 0
    for (let i = 0; i < count; i++) {
      const { image } = await decoder.decode({ frameIndex: i })
      const seconds = image.duration ? image.duration / 1e6 : DEFAULT_FRAME_SECONDS
      frames.push({ image: await createImageBitmap(image), start: time, end: time + seconds })
      time += seconds
      image.close()
    }
    decoder.close()
    const first = frames[0].image
    return { frames, duration: count > 1 ? time : null, width: first.width, height: first.height }
  }
  const element = new Image()
  element.src = url
  await element.decode()
  return { frames: [{ image: element, start: 0, end: Infinity }], duration: null, width: element.naturalWidth, height: element.naturalHeight }
}

export function loadAnimatedImage(url) {
  if (!cache.has(url)) {
    const loading = decode(url)
    loading.then(
      (decoded) => decodedAlready.set(url, decoded),
      () => cache.delete(url), // try again next time
    )
    cache.set(url, loading)
  }
  return cache.get(url)
}

// The decoded image if it's ready now (preloaded), so a cast can start on
// this very frame; otherwise null.
export function decodedImage(url) {
  return decodedAlready.get(url) ?? null
}

// The frame showing `seconds` into the animation.
export function frameAt(decoded, seconds) {
  const { frames } = decoded
  let low = 0
  let high = frames.length - 1
  while (low < high) {
    const mid = (low + high) >> 1
    if (frames[mid].end <= seconds) low = mid + 1
    else high = mid
  }
  return frames[low].image
}
