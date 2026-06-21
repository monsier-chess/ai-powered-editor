import type { AIOperationResult } from '../../core/types'

interface InlineDiffProps {
  operation: AIOperationResult
  fullContent: string
  onAcceptHunk: (hunkId: string) => void
  onRejectHunk: (hunkId: string) => void
  onAcceptAll: () => void
  onRejectAll: () => void
}

interface Segment {
  type: 'context' | 'hunk'
  text?: string
  hunk?: AIOperationResult['hunks'][0]
}

function buildSegments(originalText: string, hunks: AIOperationResult['hunks']): Segment[] {
  const lines = originalText.split('\n')
  const sorted = [...hunks].sort((a, b) => a.oldStart - b.oldStart)
  const segments: Segment[] = []
  let lineIdx = 0

  for (const hunk of sorted) {
    const hunkStart = hunk.oldStart - 1
    if (lineIdx < hunkStart) {
      segments.push({ type: 'context', text: lines.slice(lineIdx, hunkStart).join('\n') })
    }
    segments.push({ type: 'hunk', hunk })
    lineIdx = hunkStart + hunk.oldLines.length
  }

  if (lineIdx < lines.length) {
    segments.push({ type: 'context', text: lines.slice(lineIdx).join('\n') })
  }

  return segments
}

export function InlineDiff({
  operation,
  fullContent,
  onAcceptHunk,
  onRejectHunk,
  onAcceptAll,
  onRejectAll,
}: InlineDiffProps) {
  const hasPending = operation.hunks.length > 0

  // Context lines before and after the changed region
  const originalOffset = fullContent.indexOf(operation.originalText)
  const beforeText = originalOffset > 0 ? fullContent.substring(0, originalOffset) : ''
  const afterText = originalOffset >= 0 ? fullContent.substring(originalOffset + operation.originalText.length) : ''

  const segments = buildSegments(operation.originalText, operation.hunks)

  return (
    <div className="inline-diff">
      <div className="inline-diff-bar">
        {hasPending ? (
          <>
            <button className="btn-accept" onClick={onAcceptAll}>Accept All</button>
            <button className="btn-reject" onClick={onRejectAll}>Reject All</button>
            {operation.comment && (
              <span className="inline-diff-comment">{operation.comment}</span>
            )}
          </>
        ) : (
          <span className="inline-diff-done">All changes reviewed</span>
        )}
      </div>

      <div className="inline-diff-content">
        {beforeText && (
          <pre className="inline-diff-context">{beforeText}</pre>
        )}

        {segments.map((seg, i) => {
          if (seg.type === 'context') {
            return <pre key={i} className="inline-diff-context">{seg.text}</pre>
          }

          const hunk = seg.hunk!
          return (
            <div key={hunk.id} className="inline-diff-hunk">
              {hunk.oldLines.length > 0 && (
                <pre className="inline-diff-removed">
                  {hunk.oldLines.map((line, j) => (
                    <div key={j} className="inline-diff-line removed">{'- ' + line}</div>
                  ))}
                </pre>
              )}
              {hunk.newLines.length > 0 && (
                <pre className="inline-diff-added">
                  {hunk.newLines.map((line, j) => (
                    <div key={j} className="inline-diff-line added">{'+ ' + line}</div>
                  ))}
                </pre>
              )}
              <div className="inline-diff-hunk-actions">
                <button className="btn-accept" onClick={() => onAcceptHunk(hunk.id)}>Accept</button>
                <button className="btn-reject" onClick={() => onRejectHunk(hunk.id)}>Reject</button>
              </div>
            </div>
          )
        })}

        {afterText && (
          <pre className="inline-diff-context">{afterText}</pre>
        )}
      </div>
    </div>
  )
}
