import { useState } from 'react'
import { useData } from '../library/DataContext.js'
import { formatDate } from '../library/formats.js'
import Workspace from '../components/Workspace.jsx'
import ListPanel from '../components/ListPanel.jsx'
import MediaPreview from '../components/MediaPreview.jsx'
import FileSelect from '../components/FileSelect.jsx'

// The spellbook: each spell links a gesture to an animation and a sound from
// the shared library. Any of the three can be missing; the viewer shows
// whatever the spell has so far.
export default function SpellsTab() {
  const { spells, library, findFile, createSpell, updateSpell, removeSpell } = useData()
  const [selectedId, setSelectedId] = useState(null)
  const selected = spells.find((spell) => spell.id === selectedId) ?? spells[0]

  async function handleNew() {
    const spell = await createSpell()
    setSelectedId(spell.id)
  }

  async function handleDelete() {
    if (!window.confirm(`Delete the spell "${selected.name}"?`)) return
    await removeSpell(selected)
    setSelectedId(null)
  }

  return (
    <Workspace
      list={
        <ListPanel
          title="Spells"
          items={spells.map((spell) => ({ id: spell.id, name: spell.name, meta: spell.builtIn ? 'test' : null }))}
          selectedId={selected?.id}
          onSelect={setSelectedId}
          onAdd={handleNew}
          addLabel="New spell"
          empty="No spells yet."
        />
      }
      viewer={selected ? <SpellStage key={selected.id} spell={selected} findFile={findFile} /> : null}
      details={
        selected && (
          <SpellDetails
            spell={selected}
            library={library}
            onChange={(changes) => updateSpell(selected, changes)}
            onDelete={handleDelete}
          />
        )
      }
    />
  )
}

function SpellStage({ spell, findFile }) {
  const animation = findFile('animations', spell.animationId)
  const audio = findFile('audio', spell.audioId)
  const parts = [spell.gesture && 'gesture', animation && 'animation', audio && 'audio'].filter(Boolean)

  if (parts.length === 0) {
    return <p className="muted centered">This spell has no gesture, animation or audio yet.</p>
  }
  return (
    <div className="stage">
      <div className="stage-chips">
        {['gesture', 'animation', 'audio'].map((part) => (
          <span key={part} className={parts.includes(part) ? 'chip on' : 'chip'}>
            {part}
          </span>
        ))}
      </div>
      <div className="stage-main">
        {animation ? (
          <MediaPreview kind="animations" item={animation} />
        ) : (
          <p className="muted centered">
            {spell.gesture ? `Gesture: ${spell.gesture.label}. Gesture playback comes later.` : 'No animation'}
          </p>
        )}
      </div>
      {audio && (
        <div className="stage-audio">
          <MediaPreview kind="audio" item={audio} />
        </div>
      )}
    </div>
  )
}

function SpellDetails({ spell, library, onChange, onDelete }) {
  const locked = spell.builtIn
  return (
    <div className="details">
      <div className="details-head">
        {locked ? (
          <h2>{spell.name}</h2>
        ) : (
          <input className="title-input" value={spell.name} onChange={(event) => onChange({ name: event.target.value })} aria-label="Spell name" />
        )}
        {!locked && (
          <button className="neon-button small danger" onClick={onDelete}>
            Delete
          </button>
        )}
      </div>
      <div className="details-grid">
        <dl className="facts">
          <dt>Gesture</dt>
          <dd>
            {spell.gesture ? spell.gesture.label : 'Not recorded'}
            {spell.gesture?.recordedAt && ` (${formatDate(spell.gesture.recordedAt)})`}
            {!locked && (
              <button className="neon-button small" disabled title="Gesture recording comes next">
                Record gesture (coming soon)
              </button>
            )}
          </dd>
          <dt>Animation</dt>
          <dd>
            <FileSelect items={library.animations} value={spell.animationId} disabled={locked} onChange={(id) => onChange({ animationId: id })} />
          </dd>
          <dt>Audio</dt>
          <dd>
            <FileSelect items={library.audio} value={spell.audioId} disabled={locked} onChange={(id) => onChange({ audioId: id })} />
          </dd>
          <dt>Created</dt>
          <dd>{locked ? 'Built-in' : formatDate(spell.createdAt)}</dd>
        </dl>
        <label className="field">
          <span>Description</span>
          {locked ? (
            <p className="muted">{spell.description}</p>
          ) : (
            <textarea value={spell.description} onChange={(event) => onChange({ description: event.target.value })} placeholder="What the spell does…" />
          )}
        </label>
      </div>
    </div>
  )
}
