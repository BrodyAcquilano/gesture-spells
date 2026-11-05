// A dropdown of library files, with None and a marker for a deleted file.
export default function FileSelect({ items, value, onChange, disabled }) {
  const missing = value && !items.some((item) => item.id === value)
  return (
    <select className="select" value={value ?? ''} disabled={disabled} onChange={(event) => onChange(event.target.value || null)}>
      <option value="">None</option>
      {missing && <option value={value}>(missing file)</option>}
      {items.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name}
        </option>
      ))}
    </select>
  )
}
