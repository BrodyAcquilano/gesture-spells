// Encodes sound samples as a WAV file (16-bit PCM). WAV is a 44-byte header
// followed by the raw samples, so this is all it takes.
//   channels: one Float32Array per channel, values between -1 and 1
export function encodeWav(channels, sampleRate) {
  const count = channels.length
  const samples = channels[0].length
  const bytesPerSample = 2
  const dataSize = samples * count * bytesPerSample
  const view = new DataView(new ArrayBuffer(44 + dataSize))
  const text = (offset, value) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)))

  text(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  view.setUint32(16, 16, true) // size of this "fmt " section
  view.setUint16(20, 1, true) // 1 = uncompressed PCM
  view.setUint16(22, count, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * count * bytesPerSample, true)
  view.setUint16(32, count * bytesPerSample, true)
  view.setUint16(34, 16, true) // bits per sample
  text(36, 'data')
  view.setUint32(40, dataSize, true)

  // Samples are interleaved: left, right, left, right…
  let offset = 44
  for (let i = 0; i < samples; i++) {
    for (let c = 0; c < count; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]))
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
      offset += 2
    }
  }
  return new Blob([view], { type: 'audio/wav' })
}
