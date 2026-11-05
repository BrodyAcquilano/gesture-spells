import { useState } from 'react'
import { useData } from '../library/DataContext.js'
import { formatDate } from '../library/formats.js'
import Workspace from '../components/Workspace.jsx'
import ListPanel from '../components/ListPanel.jsx'
import FileSelect from '../components/FileSelect.jsx'
import GestureRecorder, { SUGGESTED_EXAMPLES } from '../components/GestureRecorder.jsx'
import SpellPlayback from '../components/SpellPlayback.jsx'

// The spellbook: each spell has a recorded gesture, and an animation and an
// audio file chosen from the shared library. Any of the three can be missing.
// Built-in spells ship with the app and are read-only; "Make a copy" gives an
// editable version.
export default function SpellsTab() {
  const { spells, library, findFile, createSpell, updateSpell, removeSpell } = useData()
  const [selectedId, setSelectedId] = useState(null)
  const [recording, setRecording] = useState(false)
  const selected = spells.find((spell) => spell.id === selectedId) ?? spells[0]
  const locked = Boolean(selected?.builtIn)

  function select(id) {
    setSelectedId(id)
    setRecording(false)
  }

  async function handleNew(template) {
    const spell = await createSpell(template)
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
  let viewer = <p className="muted centered">No spells yet. Press the green + to make one.</p>
  if (selected && recording) {
    viewer = <GestureRecorder key={selected.id} exampleCount={exampleCount} onSave={saveExample} onClose={() => setRecording(false)} />
  } else if (selected) {
    viewer = <SpellStage key={selected.id} spell={selected} findFile={findFile} onRecord={locked ? null : () => setRecording(true)} />
  }

  return (
    <Workspace
      list={
        <ListPanel
          title="Spells"
          items={spells.map((spell) => ({
            id: spell.id,
            name: spell.name || 'Untitled',
            meta: spell.builtIn ? 'built-in' : spell.gesture?.examples?.length ? `${spell.gesture.examples.length} ex.` : 'no gesture',
          }))}
          selectedId={selected?.id}
          onSelect={select}
          onAdd={() => handleNew()}
          addLabel="New spell"
          empty="No spells yet. Press + to make one."
        />
      }
      viewer={viewer}
      details={
        selected && (
          <div className="details">
            <div className="details-head">
              {locked ? (
                <h2>{selected.name}</h2>
              ) : (
                <input
                  className="title-input"
                  value={selected.name}
                  onChange={(event) => updateSpell(selected.id, { name: event.target.value })}
                  aria-label="Spell name"
                />
              )}
              <div className="button-row">
                <button className="neon-button small" onClick={() => handleNew(selected)}>
                  Make a copy
                </button>
                {!locked && (
                  <button className="neon-button small danger" onClick={handleDelete}>
                    Delete spell
                  </button>
                )}
              </div>
            </div>
            <div className="details-grid">
              <dl className="facts">
                <dt>Gesture</dt>
                <dd>
                  {exampleCount === 0 ? 'Not recorded' : `${exampleCount} example${exampleCount === 1 ? '' : 's'}`}
                  {!locked && exampleCount > 0 && exampleCount < SUGGESTED_EXAMPLES && (
                    <span className="muted small">(record {SUGGESTED_EXAMPLES}+)</span>
                  )}
                  {!locked && (
                    <button className="neon-button small" onClick={() => setRecording(true)} disabled={recording}>
                      {exampleCount ? 'Add examples' : 'Record gesture'}
                    </button>
                  )}
                  {!locked && exampleCount > 0 && (
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
                        disabled={locked}
                        value={selected.sensitivity ?? 1}
                        onChange={(event) => updateSpell(selected.id, { sensitivity: Number(event.target.value) })}
                      />
                      <span className="muted small">×{(selected.sensitivity ?? 1).toFixed(1)} (higher casts more easily)</span>
                    </dd>
                  </>
                )}
                <dt>Animation</dt>
                <dd>
                  <FileSelect
                    items={library.animations}
                    value={selected.animationId}
                    disabled={locked}
                    onChange={(id) => updateSpell(selected.id, { animationId: id })}
                  />
                </dd>
                <dt>Audio</dt>
                <dd>
                  <FileSelect
                    items={library.audio}
                    value={selected.audioId}
                    disabled={locked}
                    onChange={(id) => updateSpell(selected.id, { audioId: id })}
                  />
                </dd>
                <dt>Created</dt>
                <dd>{locked ? 'Built-in' : formatDate(selected.createdAt)}</dd>
              </dl>
              <label className="field">
                <span>Description</span>
                {locked ? (
                  <p className="muted">{selected.description}</p>
                ) : (
                  <textarea
                    value={selected.description}
                    onChange={(event) => updateSpell(selected.id, { description: event.target.value })}
                    placeholder="What the spell does…"
                  />
                )}
                {locked && <p className="muted small">Built-in spells can&apos;t be changed. Make a copy to edit one.</p>}
              </label>
            </div>
          </div>
        )
      }
    />
  )
}

// The viewer: one Play/Pause button plays whatever the spell has: the gesture,
// then its animation and audio together. Markers show which parts are set.
function SpellStage({ spell, findFile, onRecord }) {
  const animation = findFile('animations', spell.animationId)
  const audio = findFile('audio', spell.audioId)
  const gesture = spell.gesture?.examples?.length ? spell.gesture : null
  const has = { gesture: Boolean(gesture), animation: Boolean(animation), audio: Boolean(audio) }

  return (
    <div className="stage">
      <div className="stage-chips">
        {Object.entries(has).map(([part, on]) => (
          <span key={part} className={on ? 'chip on' : 'chip'}>
            {part}
          </span>
        ))}
        {!gesture && onRecord && (
          <button className="neon-button small" onClick={onRecord}>
            Record gesture
          </button>
        )}
      </div>
      <div className="stage-main">
        {gesture || animation || audio ? (
          <SpellPlayback gesture={gesture} animation={animation} audio={audio} />
        ) : (
          <p className="muted centered">This spell has no gesture, animation or audio yet.</p>
        )}
      </div>
    </div>
  )
}
