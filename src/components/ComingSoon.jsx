// Placeholder for any box whose feature is not built yet.
export default function ComingSoon({ feature, children }) {
  return (
    <div className="coming-soon">
      <p className="coming-soon-label">Feature coming soon</p>
      {feature && <p className="coming-soon-feature">{feature}</p>}
      {children && <div className="muted">{children}</div>}
    </div>
  )
}
