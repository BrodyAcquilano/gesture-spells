import { useState } from 'react'
import { useData } from '../library/DataContext.js'
import { formatDate } from '../library/formats.js'
import Workspace from '../components/Workspace.jsx'
import ListPanel from '../components/ListPanel.jsx'
import MediaPreview from '../components/MediaPreview.jsx'
import FileSelect from '../components/FileSelect.jsx'
import GestureRecorder, { SUGGESTED_EXAMPLES } from '../components/GestureRecorder.jsx'
import GesturePlayback from '../components/GesturePlayback.jsx'

// The spellbook: each spell has a recorded gesture, and an animation and an
// audio file chosen from the shared library. Any of the three can be missing;
// the viewer shows whatever the spell has so far.
export default function SpellsTab() {
  const { spells, library, findFile, createSpell, updateSpell, removeSpell } = useData()
  const [selectedId, setSelectedId] = useState(null)
  const [recording, setRecording] = useState(false)
  const selected = spells.find((spell) => spell.id === selectedId) ?? spells[0]

  function select(id) {
    setSelectedId(id)
    setRecording(false)
  }

  async function handleNew() {
    const spell = await createSpell()
    select(spell.id)
  }

  async function handleDelete() {
    if (!window.confirm(`Delete the spell "${selected.name}"?`)) return
    await removeSpell(selected.id)
    select(null)
  }

  function saveExample(example) {
    updateSpell(selected.id, (spell) => ({
      gesture: { examples: [...(spell.gesture?.examples ?? []), example] },
    }))
  }

  function clearGesture() {
    if (!window.confirm('Delete every recorded example of this gesture?')) return
    updateSpell(selected.id, { gesture: null })
  }

  const exampleCount = selected?.gesture?.examples?.length ?? 0
  let viewer = (
    <div className="centered">
      <p className="muted">No spells yet. Press the green + to make one.</p>
    </div>
  )
  if (selected && recording) {
    viewer = <GestureRecorder key={selected.id} exampleCount={exampleCount} onSave={saveExample} onClose={() => setRecording(false)} />
  } else if (selected) {
    viewer = <SpellStage spell={selected} findFile={findFile} onRecord={() => setRecording(true)} />
  }

  return (
    <Workspace
      list={
        <ListPanel
          title="Spells"
          items={spells.map((spell) => ({
            id: spell.id,
            name: spell.name || 'Untitled',
            meta: spell.gesture?.examples?.length ? `${spell.gesture.examples.length} ex.` : 'no gesture',
          }))}
          selectedId={selected?.id}
          onSelect={select}
          onAdd={handleNew}
          addLabel="New spell"
          empty="No spells yet. Press + to make one."
        />
      }
      viewer={viewer}
      details={
        selected && (
          <div className="details">
            <div className="details-head">
              <input
                className="title-input"
                value={selected.name}
                onChange={(event) => updateSpell(selected.id, { name: event.target.value })}
                aria-label="Spell name"
              />
              <button className="neon-button small danger" onClick={handleDelete}>
                Delete spell
              </button>
            </div>
            <div className="details-grid">
              <dl className="facts">
                <dt>Gesture</dt>
                <dd>
                  {exampleCount === 0 ? 'Not recorded' : `${exampleCount} example${exampleCount === 1 ? '' : 's'}`}
                  {exampleCount > 0 && exampleCount < SUGGESTED_EXAMPLES && <span className="muted small">(record {SUGGESTED_EXAMPLES}+)</span>}
                  <button className="neon-button small" onClick={() => setRecording(true)} disabled={recording}>
                    {exampleCount ? 'Add examples' : 'Record gesture'}
                  </button>
                  {exampleCount > 0 && (
                    <button className="neon-button small danger" onClick={clearGesture}>
                      Clear
                    </button>
                  )}
                </dd>
                {exampleCount > 0 && (
                  <>
                    <dt>Recorded</dt>
                    <dd>{formatDate(selected.gesture.examples[exampleCount - 1].recordedAt)}</dd>
                    <dt>Sensitivity</dt>
                    <dd>
                      <input
                        type="range"
                        min="0.5"
                        max="2"
                        step="0.1"
                        value={selected.sensitivity ?? 1}
                        onChange={(event) => updateSpell(selected.id, { sensitivity: Number(event.target.value) })}
                      />
                      <span className="muted small">
                        ×{(selected.sensitivity ?? 1).toFixed(1)} (higher casts more easily)
                      </span>
                    </dd>
                  </>
                )}
                <dt>Animation</dt>
                <dd>
                  <FileSelect items={library.animations} value={selected.animationId} onChange={(id) => updateSpell(selected.id, { animationId: id })} />
                </dd>
                <dt>Audio</dt>
                <dd>
                  <FileSelect items={library.audio} value={selected.audioId} onChange={(id) => updateSpell(selected.id, { audioId: id })} />
                </dd>
                <dt>Created</dt>
                <dd>{formatDate(selected.createdAt)}</dd>
              </dl>
              <label className="field">
                <span>Description</span>
                <textarea
                  value={selected.description}
                  onChange={(event) => updateSpell(selected.id, { description: event.target.value })}
                  placeholder="What the spell does…"
                />
              </label>
            </div>
          </div>
        )
      }
    />
  )
}

// The viewer: the recorded gesture replaying with the spell's animation, or
// whichever parts exist, plus an audio player when the spell has a sound.
function SpellStage({ spell, findFile, onRecord }) {
  const animation = findFile('animations', spell.animationId)
  const audio = findFile('audio', spell.audioId)
  const gesture = spell.gesture?.examples?.length ? spell.gesture : null
  const has = { gesture: Boolean(gesture), animation: Boolean(animation), audio: Boolean(audio) }

  let main
  if (gesture) main = <GesturePlayback gesture={gesture} animation={animation} />
  else if (animation) main = <MediaPreview kind="animations" item={animation} />
  else main = <p className="muted centered">This spell has no gesture, animation or audio yet.</p>

  return (
    <div className="stage">
      <div className="stage-chips">
        {Object.entries(has).map(([part, on]) => (
          <span key={part} className={on ? 'chip on' : 'chip'}>
            {part}
          </span>
        ))}
        {!gesture && (
          <button className="neon-button small" onClick={onRecord}>
            Record gesture
          </button>
        )}
      </div>
      <div className="stage-main">{main}</div>
      {audio && (
        <div className="stage-audio">
          <MediaPreview kind="audio" item={audio} compact />
        </div>
      )}
    </div>
  )
}
