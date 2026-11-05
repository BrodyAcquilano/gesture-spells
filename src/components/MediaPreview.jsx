import { previewKind } from '../library/formats.js'
import SparksPreview from './SparksPreview.jsx'
import ComingSoon from './ComingSoon.jsx'

// Shows or plays one library item, whatever its format. Animations are
// silent; sound only ever comes from audio items.
export default function MediaPreview({ kind, item, compact = false }) {
  if (item.procedural === 'sparks') return <SparksPreview />

  switch (previewKind(kind, item)) {
    case 'video':
      return <video className="media" src={item.url} autoPlay loop muted playsInline />
    case 'image':
      return <img className="media" src={item.url} alt={item.name} />
    case 'audio':
      if (!item.url) return <p className="muted centered">Preparing audio…</p>
      return (
        <div className={compact ? 'audio-preview compact' : 'audio-preview'}>
          <span className="audio-icon" aria-hidden="true">♪</span>
          <audio src={item.url} controls preload="auto" />
        </div>
      )
    case 'lottie':
      return <ComingSoon feature="Lottie animation preview">The file is saved and can be assigned already.</ComingSoon>
    default:
      return null
  }
}
