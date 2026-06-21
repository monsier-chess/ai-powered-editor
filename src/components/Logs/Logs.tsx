import { useState } from 'react'
import type { LogStore } from '../../core/logging/LogStore'
import type { LogEntry } from '../../core/types'

interface LogsProps {
  logStore: LogStore
}

export function Logs({ logStore }: LogsProps) {
  const [entries, setEntries] = useState<LogEntry[]>(() => logStore.getAll())
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')

  const refresh = () => {
    if (filter === 'all') {
      setEntries([...logStore.getAll()])
    } else {
      setEntries([...logStore.getByOperationType(filter)])
    }
  }

  const handleFilterChange = (newFilter: string) => {
    setFilter(newFilter)
    if (newFilter === 'all') {
      setEntries([...logStore.getAll()])
    } else {
      setEntries([...logStore.getByOperationType(newFilter)])
    }
  }

  return (
    <div className="logs-list">
      <div style={{ padding: '8px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <select
          value={filter}
          onChange={e => handleFilterChange(e.target.value)}
          style={{ fontSize: 11, padding: '2px 4px' }}
        >
          <option value="all">All</option>
          <option value="grammar-fix">Grammar Fix</option>
          <option value="rewrite">Rewrite</option>
          <option value="poetry-grammar-fix">Poetry Fix</option>
        </select>
        <button onClick={refresh} style={{ fontSize: 11, padding: '2px 6px' }}>Refresh</button>
      </div>
      {entries.length === 0 && (
        <div className="no-diffs">No logs yet.</div>
      )}
      {[...entries].reverse().map(entry => (
        <div
          key={entry.id}
          className="log-item"
          onClick={() => setSelectedEntry(selectedEntry === entry.id ? null : entry.id)}
        >
          <div className="log-item-header">
            <span className="history-item-type">{entry.operationType}</span>
            <span>{new Date(entry.timestamp).toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--text-dim)' }}>
            <span>{entry.provider}/{entry.model}</span>
          </div>
          {selectedEntry === entry.id && (
            <div className="log-detail">
              <strong>System Prompt:</strong>
              {'\n'}{entry.systemPrompt}
              {'\n\n'}
              <strong>User Prompt:</strong>
              {'\n'}{entry.prompt}
              {'\n\n'}
              <strong>Response:</strong>
              {'\n'}{entry.response}
              {'\n\n'}
              <strong>Comment:</strong>
              {'\n'}{entry.comment || '(none)'}
              {'\n\n'}
              <strong>Diff:</strong>
              {'\n'}{entry.diff}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
