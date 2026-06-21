import type { ProviderSettings } from '../../core/types'

interface ToolbarProps {
  poetryMode: boolean
  onTogglePoetry: () => void
  onGrammarFix: () => void
  loading: boolean
  hasPendingChanges: boolean
  providerType: string
  onProviderTypeChange: (type: string) => void
  providerSettings: ProviderSettings
  onSettingsChange: (settings: Partial<ProviderSettings>) => void
  availableModels: string[]
  onRefreshModels: () => void
  onShowSettings: () => void
}

export function Toolbar({
  poetryMode,
  onTogglePoetry,
  onGrammarFix,
  loading,
  hasPendingChanges,
  providerType,
  onProviderTypeChange,
  providerSettings,
  onSettingsChange,
  availableModels,
  onRefreshModels,
}: ToolbarProps) {
  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <button
          onClick={onGrammarFix}
          disabled={loading || hasPendingChanges}
          title="Fix grammar and punctuation"
        >
          {poetryMode ? 'Poetry Fix' : 'Grammar Fix'}
        </button>
        <button
          className={`poetry-toggle ${poetryMode ? 'active' : ''}`}
          onClick={onTogglePoetry}
          title="Toggle poetry mode"
        >
          Poetry
        </button>
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <select
          value={providerType}
          onChange={e => onProviderTypeChange(e.target.value)}
        >
          <option value="ollama">Ollama</option>
          <option value="openai-compatible">OpenAI Compatible</option>
        </select>
        <select
          value={providerSettings.model}
          onChange={e => onSettingsChange({ model: e.target.value })}
        >
          {availableModels.length === 0 && (
            <option value="">No models available</option>
          )}
          {availableModels.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <button onClick={onRefreshModels} disabled={loading} title="Refresh models">
          ↻
        </button>
      </div>
    </div>
  )
}
