import ComingSoon from '../components/ComingSoon.jsx'

// The Animation Builder and Audio Lab modes, not designed yet.
export default function PlaceholderMode({ title, children }) {
  return (
    <div className="placeholder-mode">
      <section className="panel">
        <h2>{title}</h2>
        <ComingSoon>{children}</ComingSoon>
      </section>
    </div>
  )
}
