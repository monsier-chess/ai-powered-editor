import type { AIOperationResult, DiffSegment } from '../../core/types'

interface DiffViewProps {
  operation: AIOperationResult | null
  onAcceptHunk: (hunkId: string) => void
  onRejectHunk: (hunkId: string) => void
  onAcceptAll: () => void
  onRejectAll: () => void
}

function renderSegments(segments: DiffSegment[]) {
  return segments.map((seg, i) => {
    if (seg.type === 'equal') {
      return <span key={i}>{seg.text}</span>
    } else if (seg.type === 'added') {
      return <span key={i} className="intraline-added">{seg.text}</span>
    } else {
      return <span key={i} className="intraline-removed">{seg.text}</span>
    }
  })
}

export function DiffView({
  operation,
  onAcceptHunk,
  onRejectHunk,
  onAcceptAll,
  onRejectAll,
}: DiffViewProps) {
  if (!operation) {
    return (
      <div className="diff-list">
        <div className="no-diffs">No pending changes. Run a grammar fix or rewrite to see diffs.</div>
      </div>
    )
  }

  const pendingHunks = operation.hunks.filter(h => h.accepted === null)
  const allDecided = pendingHunks.length === 0

  return (
    <div className="diff-list">
      {!allDecided && (
        <div className="diff-all-actions">
          <button className="btn-accept" onClick={onAcceptAll}>
            Accept All
          </button>
          <button className="btn-reject" onClick={onRejectAll}>
            Reject All
          </button>
        </div>
      )}

      {operation.comment && (
        <div className="diff-comment">
          {operation.comment}
        </div>
      )}

      {pendingHunks.length === 0 && allDecided && (
        <div className="no-diffs">All changes have been reviewed.</div>
      )}

      {pendingHunks.map(hunk => (
        <div key={hunk.id} className="diff-item">
          <div className="diff-header">
            <span>
              @@ -{hunk.oldStart},{hunk.oldLines.length} +{hunk.newStart},{hunk.newLines.length} @@
            </span>
          </div>
          <div className="diff-lines">
            {hunk.oldLinesWithSegments.length > 0 && (
              <div className="diff-section">
                {hunk.oldLinesWithSegments.map((lineData, i) => (
                  <div key={`old-${i}`} className="diff-line diff-line-removed">
                    - {renderSegments(lineData.segments)}
                  </div>
                ))}
              </div>
            )}
            {hunk.newLinesWithSegments.length > 0 && (
              <div className="diff-section">
                {hunk.newLinesWithSegments.map((lineData, i) => (
                  <div key={`new-${i}`} className="diff-line diff-line-added">
                    + {renderSegments(lineData.segments)}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="diff-actions">
            <button className="btn-accept" onClick={() => onAcceptHunk(hunk.id)}>
              Accept
            </button>
            <button className="btn-reject" onClick={() => onRejectHunk(hunk.id)}>
              Reject
            </button>
          </div>
        </div>
      ))}

      {operation.hunks.filter(h => h.accepted !== null).map(hunk => (
        <div key={hunk.id} className="diff-item" style={{ opacity: 0.5 }}>
          <div className="diff-header">
            <span>
              @@ -{hunk.oldStart},{hunk.oldLines.length} +{hunk.newStart},{hunk.newLines.length} @@
            </span>
            <span>{hunk.accepted ? 'Accepted' : 'Rejected'}</span>
          </div>
          <div className="diff-lines">
            {hunk.oldLinesWithSegments.map((lineData, i) => (
              <div key={`old-${i}`} className="diff-line" style={{ color: 'var(--text-dim)' }}>
                {renderSegments(lineData.segments)}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
