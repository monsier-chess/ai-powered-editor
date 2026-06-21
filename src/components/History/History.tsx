import { useState } from 'react'
import type { HistoryStore } from '../../core/history/HistoryStore'
import type { HistoryEntry } from '../../core/types'

interface HistoryProps {
  historyStore: HistoryStore
}

export function History({ historyStore }: HistoryProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>(() => historyStore.getAll())
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null)

  const refresh = () => {
    setEntries([...historyStore.getAll()])
  }

  return (
    <div className="history-list">
      <div style={{ padding: '8px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Operation History</span>
        <button onClick={refresh} style={{ fontSize: 11, padding: '2px 6px' }}>Refresh</button>
      </div>
      {entries.length === 0 && (
        <div className="no-diffs">No history yet.</div>
      )}
      {[...entries].reverse().map(entry => (
        <div
          key={entry.id}
          className="history-item"
          onClick={() => setSelectedEntry(selectedEntry === entry.id ? null : entry.id)}
        >
          <div className="history-item-header">
            <span className="history-item-type">{entry.operationType}</span>
            <span>{new Date(entry.timestamp).toLocaleString()}</span>
          </div>
          <div style={{ color: 'var(--text-dim)' }}>
            {entry.comment || 'No comment'}
          </div>
          {selectedEntry === entry.id && (
            <div className="log-detail">
              Original ({entry.result.originalText.length} chars):
              {'\n'}{entry.result.originalText.slice(0, 500)}
              {entry.result.originalText.length > 500 ? '...' : ''}
              {'\n\n'}
              Modified ({entry.result.modifiedText.length} chars):
              {'\n'}{entry.result.modifiedText.slice(0, 500)}
              {entry.result.modifiedText.length > 500 ? '...' : ''}
              {'\n\n'}
              Hunks: {entry.result.hunks.length}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
