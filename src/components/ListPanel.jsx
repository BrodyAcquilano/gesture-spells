// A titled list with an optional green plus button in its top-right corner.
//   items: [{ id, name, meta? }]
export default function ListPanel({ title, items, selectedId, onSelect, onAdd, addLabel, empty }) {
  return (
    <div className="list-panel">
      <div className="list-head">
        <h2>{title}</h2>
        {onAdd && (
          <button className="plus-button" onClick={onAdd} title={addLabel} aria-label={addLabel}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="list-empty muted">{empty}</p>
      ) : (
        <ul className="list">
          {items.map((item) => (
            <li key={item.id}>
              <button
                className={item.id === selectedId ? 'list-item selected' : 'list-item'}
                onClick={() => onSelect(item.id)}
              >
                <span className="list-name">{item.name}</span>
                {item.meta && <span className="list-meta">{item.meta}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
