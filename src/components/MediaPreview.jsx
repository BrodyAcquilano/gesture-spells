import { useEffect, useRef } from 'react'
import { previewKind } from '../library/formats.js'
import { playSparkSound } from '../effects/sparkSound.js'
import SparksPreview from './SparksPreview.jsx'
import ComingSoon from './ComingSoon.jsx'

// Shows or plays one library item, whatever its format.
export default function MediaPreview({ kind, item }) {
  if (item.procedural === 'sparks') return <SparksPreview />
  if (item.procedural === 'spark-ting') return <SynthPreview name={item.name} play={playSparkSound} />

  switch (previewKind(kind, item)) {
    case 'video':
      return <video className="media" src={item.url} autoPlay loop muted controls playsInline />
    case 'image':
      return <img className="media" src={item.url} alt={item.name} />
    case 'audio':
      return (
        <div className="audio-preview">
          <span className="audio-icon" aria-hidden="true">♪</span>
          <audio src={item.url} controls />
        </div>
      )
    case 'lottie':
      return <ComingSoon feature="Lottie animation preview">The file is saved and can be assigned already.</ComingSoon>
    default:
      return null
  }
}

function SynthPreview({ name, play }) {
  const contextRef = useRef(null)
  useEffect(() => () => contextRef.current?.close(), [])

  function handlePlay() {
    contextRef.current ??= new AudioContext()
    play(contextRef.current)
  }

  return (
    <div className="audio-preview">
      <span className="audio-icon" aria-hidden="true">♪</span>
      <button className="neon-button" onClick={handlePlay}>
        Play {name}
      </button>
    </div>
  )
}
