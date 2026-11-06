import { useRef, useState } from 'react'
import { useData } from '../library/DataContext.js'
import { LIBRARY_KINDS, acceptAttribute, extensionOf, formatBytes, formatDate } from '../library/formats.js'
import { useConfirm, useToast } from '../components/toast.js'
import Workspace from '../components/Workspace.jsx'
import ListPanel from '../components/ListPanel.jsx'
import MediaPreview from '../components/MediaPreview.jsx'
import { ANCHOR_GROUPS, pivotFor } from '../library/placement.js'
import { PROCEDURAL_ANIMATIONS, placementOf } from '../effects/animations.js'

// The Animations tab and the Audio tab (kind = 'animations' | 'audio').
// Every item, whether uploaded or made by code, can be renamed, described and
// deleted; the changes are saved into public/library/<kind>/index.json (part
// of the repository). Every animation also has its placement on the hand
// (src/library/placement.js): where it attaches, its size and whether it
// follows the hand. Ones drawn by code start from their own defaults. An item a spell uses can't be deleted: a message says
// which spells use it. Both modes show the same library.
export default function LibraryTab({ kind }) {
  const { library, spells, addFiles, updateFile, removeFile, loadError, spellsReadOnly } = useData()
  const showMessage = useToast()
  const confirm = useConfirm()
  const info = LIBRARY_KINDS[kind]
  const items = library[kind]
  const [selectedId, setSelectedId] = useState(null)
  const [message, setMessage] = useState('')
  const inputRef = useRef(null)
  const selected = items.find((item) => item.id === selectedId) ?? items[0]
  const editable = !spellsReadOnly

  async function handleFiles(event) {
    const files = [...event.target.files]
    event.target.value = '' // so choosing the same file again still fires
    if (files.length === 0) return
    try {
      const { added, rejected } = await addFiles(kind, files)
      if (added.length) setSelectedId(added[added.length - 1].id)
      setMessage(rejected.length ? `Not a supported format: ${rejected.join(', ')}` : '')
    } catch (error) {
      setMessage(`Could not save: ${error.message}`)
    }
  }

  async function handleDelete() {
    const field = kind === 'animations' ? 'animationId' : 'audioId'
    const users = spells.filter((spell) => spell[field] === selected.id)
    if (users.length) {
      const names = users.map((spell) => `"${spell.name}"`).join(', ')
      showMessage(
        `This ${info.singular} is in use by ${users.length === 1 ? 'a spell' : 'spells'} in the spellbook: ${names}. Choose a different ${info.singular} for ${users.length === 1 ? 'it' : 'them'} first, then delete it.`,
      )
      return
    }
    const what = selected.file ? ` Its file public/library/${kind}/${selected.file} is deleted too.` : ''
    if (!(await confirm(`Delete "${selected.name}" from the library?${what}`))) return
    try {
      await removeFile(kind, selected)
      setSelectedId(null)
    } catch (error) {
      setMessage(`Could not delete: ${error.message}`)
    }
  }

  const upload = () => inputRef.current.click()

  const placement = placementOf(selected)
  const setPlacement = (changes) => updateFile(kind, selected, { placement: { ...placement, ...changes } })
  const placed = kind === 'animations' && selected && (selected.file || PROCEDURAL_ANIMATIONS[selected.procedural])
  const drawnByCode = Boolean(PROCEDURAL_ANIMATIONS[selected?.procedural])
  const canFollow = !drawnByCode || Boolean(PROCEDURAL_ANIMATIONS[selected.procedural].canFollow)

  let format = '—'
  if (selected?.procedural) format = kind === 'audio' ? 'WAV, made by code' : 'Drawn by code'
  else if (selected?.file) format = extensionOf(selected.file).toUpperCase()

  return (
    <Workspace
      list={
        <ListPanel
          title={info.title}
          items={items.map((item) => ({ id: item.id, name: item.name, meta: formatBytes(item.size) === '—' ? '' : formatBytes(item.size) }))}
          selectedId={selected?.id}
          onSelect={setSelectedId}
          onAdd={editable ? upload : null}
          addLabel={`Upload ${info.singular}`}
          empty={`No ${kind} yet. Use the + button to upload one.`}
        />
      }
      viewer={
        selected ? (
          <MediaPreview key={selected.id} kind={kind} item={selected} />
        ) : (
          <p className="muted centered">Nothing selected</p>
        )
      }
      details={
        <div className="details">
          <input ref={inputRef} type="file" hidden multiple accept={acceptAttribute(kind)} onChange={handleFiles} />
          {loadError && <p className="error">{loadError}</p>}
          {selected ? (
            <>
              <div className="details-head">
                {editable ? (
                  <input
                    className="title-input"
                    value={selected.name}
                    onChange={(event) => updateFile(kind, selected, { name: event.target.value })}
                    aria-label={`${info.singular} name`}
                  />
                ) : (
                  <h2>{selected.name}</h2>
                )}
              </div>
              {placed && (
                <label className="field">
                  <span>Position on the hand</span>
                  <select
                    className="select"
                    value={placement.anchor}
                    disabled={!editable}
                    onChange={(event) => setPlacement({ anchor: event.target.value })}
                  >
                    {ANCHOR_GROUPS.map((group) => (
                      <optgroup key={group.label} label={group.label}>
                        {Object.entries(group.anchors).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <span className="muted small">
                    {drawnByCode
                      ? 'Drawn by code: it appears at this point the way it was designed to.'
                      : pivotFor(placement.anchor) === 'bottom'
                        ? "The middle of the animation's bottom edge goes on this point, so it comes out of the finger."
                        : 'The centre of the animation goes on this point.'}
                  </span>
                </label>
              )}
              <dl className="facts">
                <dt>Source</dt>
                <dd>{selected.procedural ? 'Made by code (src/effects/)' : `File: public/library/${kind}/${selected.file}`}</dd>
                <dt>Format</dt>
                <dd>{format}</dd>
                <dt>Size</dt>
                <dd>{formatBytes(selected.size)}</dd>
                <dt>Added</dt>
                <dd>{formatDate(selected.addedAt)}</dd>
                {placed && (
                  <>
                    {drawnByCode ? (
                      <>
                        <dt>Size</dt>
                        <dd>
                          ×{' '}
                          <input
                            type="number"
                            min="0.25"
                            max="4"
                            step="0.25"
                            value={placement.scale}
                            disabled={!editable}
                            onChange={(event) => setPlacement({ scale: Number(event.target.value) })}
                            aria-label="Size, times its designed size"
                          />{' '}
                          <span className="muted small">its designed size × this (1: as designed)</span>
                        </dd>
                      </>
                    ) : (
                      <>
                        <dt>Height</dt>
                        <dd>
                          <input
                            type="number"
                            min="0.5"
                            max="20"
                            step="0.5"
                            value={placement.size}
                            disabled={!editable}
                            onChange={(event) => setPlacement({ size: Number(event.target.value) })}
                            aria-label="Height in palm lengths"
                          />{' '}
                          <span className="muted small">palm lengths (scales with the hand)</span>
                        </dd>
                      </>
                    )}
                    <dt>Follows the hand</dt>
                    <dd>
                      <label>
                        <input
                          type="checkbox"
                          checked={placement.follow}
                          disabled={!editable || !canFollow}
                          onChange={(event) => setPlacement({ follow: event.target.checked })}
                        />{' '}
                        <span className="muted small">
                          {canFollow ? 'moves with the hand while it plays' : 'stays where it was cast (it bursts out from there)'}
                        </span>
                      </label>
                    </dd>
                  </>
                )}
              </dl>
              <label className="field">
                <span>Description</span>
                {editable ? (
                  <textarea
                    value={selected.description ?? ''}
                    onChange={(event) => updateFile(kind, selected, { description: event.target.value })}
                    placeholder="What it looks or sounds like, where it came from…"
                  />
                ) : (
                  <p className="muted">{selected.description}</p>
                )}
              </label>
              {editable && (
                <div className="delete-row">
                  <button className="neon-button small danger" onClick={handleDelete}>
                    Delete {info.singular}
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="muted">Upload a file to start the library.</p>
          )}
          {editable && (
            <div className="upload-row">
              <button className="neon-button" onClick={upload}>
                Upload {info.singular}
              </button>
              <span className="muted small">{info.describe}</span>
            </div>
          )}
          {message && <p className="error">{message}</p>}
        </div>
      }
    />
  )
}
