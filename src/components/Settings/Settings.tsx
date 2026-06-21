import type { AIProviderConfig, ProviderSettings } from '../../core/types'

interface SettingsProps {
  providerType: string
  providerConfig: AIProviderConfig
  providerSettings: ProviderSettings
  availableModels: string[]
  onProviderTypeChange: (type: string) => void
  onConfigChange: (config: Partial<AIProviderConfig>) => void
  onSettingsChange: (settings: Partial<ProviderSettings>) => void
  onRefreshModels: () => void
}

export function Settings({
  providerType,
  providerConfig,
  providerSettings,
  availableModels,
  onProviderTypeChange,
  onConfigChange,
  onSettingsChange,
  onRefreshModels,
}: SettingsProps) {
  return (
    <div className="settings-panel">
      <div className="settings-group">
        <label>Provider</label>
        <select
          value={providerType}
          onChange={e => onProviderTypeChange(e.target.value)}
        >
          <option value="ollama">Ollama</option>
          <option value="openai-compatible">OpenAI Compatible</option>
        </select>
      </div>

      <div className="settings-group">
        <label>Base URL</label>
        <input
          type="text"
          value={providerConfig.baseUrl || ''}
          onChange={e => onConfigChange({ baseUrl: e.target.value })}
          placeholder="http://localhost:11434"
        />
      </div>

      {providerType !== 'ollama' && (
        <div className="settings-group">
          <label>API Key</label>
          <input
            type="password"
            value={providerConfig.apiKey || ''}
            onChange={e => onConfigChange({ apiKey: e.target.value })}
            placeholder="sk-..."
          />
        </div>
      )}

      <div className="settings-group">
        <label>Model</label>
        <div style={{ display: 'flex', gap: 4 }}>
          <select
            value={providerSettings.model}
            onChange={e => onSettingsChange({ model: e.target.value })}
            style={{ flex: 1 }}
          >
            {availableModels.length === 0 && (
              <option value="">No models available</option>
            )}
            {availableModels.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <button onClick={onRefreshModels} title="Refresh models">↻</button>
        </div>
      </div>

      <div className="settings-group">
        <label>Temperature</label>
        <input
          type="number"
          min={0}
          max={2}
          step={0.1}
          value={providerSettings.temperature}
          onChange={e => onSettingsChange({ temperature: parseFloat(e.target.value) || 0 })}
        />
      </div>

      <div className="settings-group">
        <label>Max Tokens</label>
        <input
          type="number"
          min={1}
          max={131072}
          step={1}
          value={providerSettings.maxTokens}
          onChange={e => onSettingsChange({ maxTokens: parseInt(e.target.value) || 4096 })}
        />
      </div>

      <div className="settings-group">
        <div className="settings-checkbox">
          <input
            type="checkbox"
            id="thinking"
            checked={providerSettings.thinking}
            onChange={e => onSettingsChange({ thinking: e.target.checked })}
          />
          <label htmlFor="thinking">Thinking (if supported)</label>
        </div>
      </div>
    </div>
  )
}
