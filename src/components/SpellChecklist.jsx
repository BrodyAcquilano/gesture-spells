// Tick boxes for choosing which spells are recognised. A green tick to the
// left of each spell's name; spells without a recorded gesture can't be
// recognised, so they are shown but can't be ticked.
//   selected: array of spell ids   onChange(newArray)
export default function SpellChecklist({ spells, selected, onChange }) {
  const usable = spells.filter((spell) => spell.gesture?.examples?.length)
  const toggle = (id) => onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id])
  return (
    <div className="list-panel">
      <div className="list-head">
        <h2>Spells to recognise</h2>
        <div className="button-row">
          <button className="neon-button small" onClick={() => onChange(usable.map((s) => s.id))}>
            All
          </button>
          <button className="neon-button small" onClick={() => onChange([])}>
            None
          </button>
        </div>
      </div>
      <ul className="list">
        {spells.map((spell) => {
          const canUse = usable.includes(spell)
          const on = canUse && selected.includes(spell.id)
          return (
            <li key={spell.id}>
              <button
                className={on ? 'check-item on' : 'check-item'}
                role="checkbox"
                aria-checked={on}
                disabled={!canUse}
                onClick={() => toggle(spell.id)}
                title={canUse ? undefined : 'This spell has no recorded gesture yet'}
              >
                <span className="check-box" aria-hidden="true">
                  {on ? '✓' : ''}
                </span>
                <span className="list-name">{spell.name}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
