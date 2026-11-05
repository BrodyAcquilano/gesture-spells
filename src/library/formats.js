// Which files the animation and audio libraries accept, and how to preview
// each. These are formats Edge and Chrome can play with no extra package.

export const LIBRARY_KINDS = {
  animations: {
    singular: 'animation',
    title: 'Animations',
    extensions: ['webm', 'mp4', 'gif', 'webp', 'png', 'apng', 'json'],
    describe: 'WebM or MP4 video (WebM can have a transparent background), GIF, animated WebP or PNG, Lottie JSON',
  },
  audio: {
    singular: 'audio file',
    title: 'Audio',
    extensions: ['mp3', 'wav', 'ogg', 'oga', 'opus', 'm4a', 'aac', 'flac', 'webm'],
    describe: 'MP3, WAV, OGG, Opus, M4A/AAC, FLAC, WebM audio',
  },
}

export function extensionOf(name) {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase()
}

export function isAccepted(kind, file) {
  return LIBRARY_KINDS[kind].extensions.includes(extensionOf(file.name))
}

export function acceptAttribute(kind) {
  return LIBRARY_KINDS[kind].extensions.map((ext) => `.${ext}`).join(',')
}

// 'video' | 'image' | 'lottie' | 'audio'
export function previewKind(kind, item) {
  if (kind === 'audio') return 'audio'
  const ext = extensionOf(item.name)
  if (ext === 'json') return 'lottie'
  if (ext === 'webm' || ext === 'mp4') return 'video'
  return 'image'
}

export function formatBytes(bytes) {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function formatDate(time) {
  return time ? new Date(time).toLocaleString() : '—'
}
