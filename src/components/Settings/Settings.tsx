import { useState } from 'react'
import type { AIProviderConfig, ProcessingSettings, ProviderSettings } from '../../core/types'

interface SettingsProps {
  providerType: string
  providerConfig: AIProviderConfig
  providerSettings: ProviderSettings
  processingSettings: ProcessingSettings
  availableModels: string[]
  onProviderTypeChange: (type: string) => void
  onConfigChange: (config: Partial<AIProviderConfig>) => void
  onSettingsChange: (settings: Partial<ProviderSettings>) => void
  onProcessingSettingsChange: (settings: Partial<ProcessingSettings>) => void
  onRefreshModels: () => void
}

export function Settings({
  providerType,
  providerConfig,
  providerSettings,
  processingSettings,
  availableModels,
  onProviderTypeChange,
  onConfigChange,
  onSettingsChange,
  onProcessingSettingsChange,
  onRefreshModels,
}: SettingsProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false)

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

      <div className="settings-section-header" onClick={() => setAdvancedOpen(o => !o)}>
        <span className="settings-section-arrow">{advancedOpen ? '▾' : '▸'}</span>
        Advanced
      </div>

      {advancedOpen && (
        <div className="settings-advanced">
          <div className="settings-group">
            <label title="Maximum characters per chunk. Set to 0 to disable chunking.">
              Chunk size (chars)
            </label>
            <input
              type="number"
              min={0}
              max={100000}
              step={500}
              value={processingSettings.chunkSize}
              onChange={e => onProcessingSettingsChange({ chunkSize: parseInt(e.target.value) || 0 })}
            />
            <span className="settings-hint">
              {processingSettings.chunkSize === 0
                ? 'Chunking disabled'
                : `Texts longer than ${processingSettings.chunkSize} chars will be split`}
            </span>
          </div>

          <div className="settings-group">
            <label title="Characters from the previous chunk's output sent as read-only context to the next chunk.">
              Context overlap (chars)
            </label>
            <input
              type="number"
              min={0}
              max={2000}
              step={50}
              value={processingSettings.chunkOverlap}
              onChange={e => onProcessingSettingsChange({ chunkOverlap: parseInt(e.target.value) || 0 })}
            />
            <span className="settings-hint">Preceding context sent to each chunk for continuity</span>
          </div>

          <div className="settings-group">
            <label title="Abort if no tokens are received for this many seconds. Resets on each new token.">
              Inactivity timeout (sec)
            </label>
            <input
              type="number"
              min={5}
              max={600}
              step={5}
              value={processingSettings.inactivityTimeout}
              onChange={e => onProcessingSettingsChange({ inactivityTimeout: parseInt(e.target.value) || 60 })}
            />
            <span className="settings-hint">Timer resets on every received token</span>
          </div>
        </div>
      )}
    </div>
  )
}
