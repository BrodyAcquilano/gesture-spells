// A short "ting" made with the Web Audio API, built into the browser: two sine
// oscillators sweep upwards while a gain envelope makes the sound start
// sharply and die away. It stands in until there is a real audio library.

export function playSparkSound(audioContext) {
  const now = audioContext.currentTime
  const gain = audioContext.createGain()
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.25, now + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45)
  gain.connect(audioContext.destination)

  for (const [start, end] of [
    [1200, 2400],
    [1800, 3200],
  ]) {
    const oscillator = audioContext.createOscillator()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(start, now)
    oscillator.frequency.exponentialRampToValueAtTime(end, now + 0.25)
    oscillator.connect(gain)
    oscillator.start(now)
    oscillator.stop(now + 0.5)
  }
}
