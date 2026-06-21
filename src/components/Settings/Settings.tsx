import { useState } from 'react'
import type { AIProviderConfig, ProcessingSettings, ProviderSettings, STTSettings } from '../../core/types'
import type { SpeechToTextProvider } from '../../core/stt/SpeechToTextProvider'

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
  sttSettings: STTSettings
  onSTTSettingsChange: (s: Partial<STTSettings>) => void
  sttProvider: SpeechToTextProvider
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
  sttSettings,
  onSTTSettingsChange,
  sttProvider,
}: SettingsProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [sttOpen, setSttOpen] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle')
  const [testError, setTestError] = useState<string | null>(null)

  const handleTestConnection = async () => {
    setTestStatus('checking')
    setTestError(null)
    try {
      const result = await sttProvider.checkAvailability()
      if (result.available) {
        setTestStatus('ok')
      } else {
        setTestStatus('error')
        setTestError(result.error ?? 'Not available')
      }
    } catch (err) {
      setTestStatus('error')
      setTestError(String(err))
    }
  }

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

      <div className="settings-section-header" onClick={() => setSttOpen(o => !o)}>
        <span className="settings-section-arrow">{sttOpen ? '▾' : '▸'}</span>
        Speech to Text
      </div>

      {sttOpen && (
        <div className="settings-advanced">
          <div className="settings-group">
            <label>STT Provider</label>
            <select
              value={sttSettings.provider}
              onChange={e => {
                onSTTSettingsChange({ provider: e.target.value as STTSettings['provider'] })
                setTestStatus('idle')
                setTestError(null)
              }}
            >
              <option value="web-speech">Web Speech (built-in)</option>
              <option value="local-whisper">Local Whisper</option>
              <option value="openai-compatible">OpenAI Compatible</option>
            </select>
          </div>

          {sttSettings.provider === 'web-speech' && (
            <div className="settings-group">
              <span className="settings-hint">
                Uses browser's built-in speech recognition. Requires internet access.
              </span>
            </div>
          )}

          {sttSettings.provider === 'local-whisper' && (
            <div className="settings-group">
              <label>Server URL</label>
              <input
                type="text"
                value={sttSettings.localWhisperUrl}
                onChange={e => onSTTSettingsChange({ localWhisperUrl: e.target.value })}
                placeholder="http://localhost:8000"
              />
              <span className="settings-hint">
                Local Whisper server exposing a /transcribe endpoint.
              </span>
            </div>
          )}

          {sttSettings.provider === 'openai-compatible' && (
            <>
              <div className="settings-group">
                <label>Base URL</label>
                <input
                  type="text"
                  value={sttSettings.openAIBaseUrl}
                  onChange={e => onSTTSettingsChange({ openAIBaseUrl: e.target.value })}
                  placeholder="http://localhost:8000/v1"
                />
              </div>
              <div className="settings-group">
                <label>API Key</label>
                <input
                  type="password"
                  value={sttSettings.openAIApiKey}
                  onChange={e => onSTTSettingsChange({ openAIApiKey: e.target.value })}
                  placeholder="sk-..."
                />
              </div>
            </>
          )}

          <div className="settings-group">
            <label>Language</label>
            <input
              type="text"
              value={sttSettings.language}
              onChange={e => onSTTSettingsChange({ language: e.target.value })}
              placeholder="ru"
            />
            <span className="settings-hint">ISO 639-1 language code, e.g. ru, en, de</span>
          </div>

          {sttSettings.provider !== 'web-speech' && (
            <div className="settings-group">
              <button onClick={handleTestConnection} disabled={testStatus === 'checking'}>
                {testStatus === 'checking' ? 'Checking…' : 'Test connection'}
              </button>
              {testStatus === 'ok' && (
                <span className="settings-hint" style={{ color: 'var(--green)' }}>Connection successful</span>
              )}
              {testStatus === 'error' && (
                <span className="settings-hint" style={{ color: 'var(--red)' }}>{testError}</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
