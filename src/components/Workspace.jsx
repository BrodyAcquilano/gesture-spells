// The layout every detailed tab uses:
//
//   ┌───────────┬──────────────────────┐
//   │           │ viewer        (2/3)  │
//   │  list     ├──────────────────────┤
//   │  (1/6)    │ timeline (optional)  │
//   │           ├──────────────────────┤
//   │           │ details       (1/3)  │
//   └───────────┴──────────────────────┘
//
// With a timeline, the viewer and details split what is left after it.
export default function Workspace({ list, viewer, timeline, details }) {
  return (
    <div className="workspace">
      <section className="panel list-area">{list}</section>
      <div className={timeline ? 'right-area with-timeline' : 'right-area'}>
        <section className="panel viewer-area">{viewer}</section>
        {timeline && <section className="panel timeline-area">{timeline}</section>}
        <section className="panel details-area">{details}</section>
      </div>
    </div>
  )
}
