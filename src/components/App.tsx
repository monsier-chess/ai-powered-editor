import { useState, useCallback, useEffect, useRef } from 'react'
import { DocumentManager } from '../core/document/DocumentManager'
import { DiffEngine } from '../core/diff/DiffEngine'
import { PromptRegistry } from '../core/prompts/PromptRegistry'
import { HistoryStore } from '../core/history/HistoryStore'
import { LogStore } from '../core/logging/LogStore'
import { ProviderRegistry } from '../core/providers/ProviderRegistry'

import { GrammarFixOperation } from '../core/operations/GrammarFixOperation'
import { RewriteOperation } from '../core/operations/RewriteOperation'
import { PoetryGrammarFixOperation } from '../core/operations/PoetryGrammarFixOperation'
import { Toolbar } from './Toolbar/Toolbar'
import { Editor } from './Editor/Editor'
import { Settings } from './Settings/Settings'
import { History } from './History/History'
import { Logs } from './Logs/Logs'
import type { AIOperationResult, AIProviderConfig, ProviderSettings } from '../core/types'
import type { AIProvider } from '../core/providers/AIProvider'

type SidebarTab = 'settings' | 'history' | 'logs'

const DEFAULT_SETTINGS: ProviderSettings = {
  model: '',
  temperature: 0.1,
  maxTokens: 4096,
  thinking: false,
}

export function App() {
  const [documentManager] = useState(() => new DocumentManager(
    '# AI Text Editor\n\nStart typing or paste your text here.\n\n## Features\n\n- Grammar Fix\n- Rewrite Selection\n- Poetry Mode\n'
  ))
  const [diffEngine] = useState(() => new DiffEngine())
  const [promptRegistry] = useState(() => new PromptRegistry())
  const [historyStore] = useState(() => new HistoryStore())
  const [logStore] = useState(() => new LogStore())
  const [providerRegistry] = useState(() => new ProviderRegistry())

  const [content, setContent] = useState(documentManager.getContent())
  const [activeOperation, setActiveOperation] = useState<AIOperationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [statusText, setStatusText] = useState('Ready')
  const [statusType, setStatusType] = useState<'info' | 'success' | 'error' | 'warning'>('info')

  const [poetryMode, setPoetryMode] = useState(false)
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('settings')
  const [selectionStart, setSelectionStart] = useState<number>(0)
  const [selectionEnd, setSelectionEnd] = useState<number>(0)

  const [providerType, setProviderType] = useState('ollama')
  const [providerConfig, setProviderConfig] = useState<AIProviderConfig>({
    type: 'ollama',
    baseUrl: 'http://localhost:11434',
    label: 'Ollama',
  })
  const [providerSettings, setProviderSettings] = useState<ProviderSettings>(DEFAULT_SETTINGS)
  const [availableModels, setAvailableModels] = useState<string[]>([])

  const getProvider = useCallback((): AIProvider => {
    let provider = providerRegistry.get(providerType)
    if (!provider) {
      provider = providerRegistry.create(providerType)
    }
    provider.configure(providerConfig)
    return provider
  }, [providerType, providerConfig, providerRegistry])

  const refreshModels = useCallback(async () => {
    try {
      const provider = getProvider()
      const available = await provider.isAvailable()
      if (!available) {
        setStatusText(`${provider.label} server is not available`)
        setStatusType('error')
        setAvailableModels([])
        return
      }
      const models = await provider.listModels()
      setAvailableModels(models)
      if (models.length > 0 && !providerSettings.model) {
        setProviderSettings(prev => ({ ...prev, model: models[0] }))
      }
      if (models.length === 0) {
        setStatusText('No models found. Please install a model.')
        setStatusType('error')
      }
    } catch (err) {
      setStatusText(`Failed to connect: ${err}`)
      setStatusType('error')
      setAvailableModels([])
    }
  }, [getProvider, providerSettings.model])

  useEffect(() => {
    refreshModels()
  }, [providerType, providerConfig.baseUrl])

  const setStatus = useCallback((text: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    setStatusText(text)
    setStatusType(type)
  }, [])

  const handleContentChange = useCallback((newContent: string) => {
    documentManager.setContent(newContent)
    setContent(newContent)
  }, [documentManager])

  const grammarFixOp = useRef(new GrammarFixOperation(promptRegistry, diffEngine, logStore))
  const poetryFixOp = useRef(new PoetryGrammarFixOperation(promptRegistry, diffEngine, logStore))
  const rewriteOp = useRef(new RewriteOperation(promptRegistry, diffEngine, logStore))

  const handleGrammarFix = useCallback(async () => {
    if (documentManager.hasPendingChanges()) {
      setStatus('Accept or reject pending changes first.', 'warning')
      return
    }

    const hasSelection = selectionStart !== selectionEnd
    const text = hasSelection
      ? content.slice(selectionStart, selectionEnd)
      : content

    if (!text.trim()) {
      setStatus('No text to process.', 'warning')
      return
    }

    setLoading(true)
    setStatus('Running grammar fix...', 'info')

    try {
      const op = poetryMode ? poetryFixOp.current : grammarFixOp.current
      const context = op.prepareContext(content, hasSelection ? { start: selectionStart, end: selectionEnd } : undefined)
      const provider = getProvider()

      const result = await op.execute(provider, text, context, providerSettings)
      result.contentStart = hasSelection ? selectionStart : 0

      documentManager.applyOperationResult(result)
      historyStore.add(result)

      setActiveOperation(result)
      setStatus(`Grammar fix complete: ${result.comment || 'No comment'}`, 'success')
    } catch (err) {
      setStatus(`Grammar fix failed: ${err}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [content, selectionStart, selectionEnd, poetryMode, documentManager, getProvider, providerSettings, historyStore, setStatus])

  const handleRewrite = useCallback(async (instruction: string) => {
    if (documentManager.hasPendingChanges()) {
      setStatus('Accept or reject pending changes first.', 'warning')
      return
    }

    if (selectionStart === selectionEnd) {
      setStatus('Select text to rewrite.', 'warning')
      return
    }

    const text = content.slice(selectionStart, selectionEnd)
    if (!text.trim()) {
      setStatus('No text to process.', 'warning')
      return
    }

    setLoading(true)
    setStatus('Running rewrite...', 'info')

    try {
      const op = rewriteOp.current
      const context = op.prepareContext(content, { start: selectionStart, end: selectionEnd })
      const provider = getProvider()

      const result = await op.execute(provider, text, context, providerSettings, {
        instruction,
      })
      result.contentStart = selectionStart

      documentManager.applyOperationResult(result)
      historyStore.add(result)

      setActiveOperation(result)
      setStatus(`Rewrite complete: ${result.comment || 'No comment'}`, 'success')
    } catch (err) {
      setStatus(`Rewrite failed: ${err}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [content, selectionStart, selectionEnd, documentManager, getProvider, providerSettings, historyStore, setStatus])

  const handleAcceptHunk = useCallback((hunkId: string) => {
    if (!activeOperation) return
    documentManager.acceptHunk(activeOperation.id, hunkId)
    setContent(documentManager.getContent())

    const updated = documentManager.getActiveOperations().find(o => o.id === activeOperation.id)
    // Spread to create a new reference so React re-renders InlineDiff with updated hunks
    setActiveOperation(updated ? { ...updated, hunks: [...updated.hunks] } : null)
  }, [activeOperation, documentManager])

  const handleRejectHunk = useCallback((hunkId: string) => {
    if (!activeOperation) return
    documentManager.rejectHunk(activeOperation.id, hunkId)
    setContent(documentManager.getContent())

    const updated = documentManager.getActiveOperations().find(o => o.id === activeOperation.id)
    setActiveOperation(updated ? { ...updated, hunks: [...updated.hunks] } : null)
  }, [activeOperation, documentManager])

  const handleAcceptAll = useCallback(() => {
    if (!activeOperation) return
    documentManager.acceptAll(activeOperation.id)
    setContent(documentManager.getContent())
    setActiveOperation(null)
    setStatus('All changes accepted.', 'success')
  }, [activeOperation, documentManager])

  const handleRejectAll = useCallback(() => {
    if (!activeOperation) return
    documentManager.rejectAll(activeOperation.id)
    setActiveOperation(null)
    setStatus('All changes rejected.', 'info')
  }, [activeOperation, documentManager])

  const handleSelectionChange = useCallback((start: number, end: number) => {
    setSelectionStart(start)
    setSelectionEnd(end)
  }, [])

  const handleProviderTypeChange = useCallback((type: string) => {
    setProviderType(type)
    const configs: Record<string, AIProviderConfig> = {
      ollama: { type: 'ollama', baseUrl: 'http://localhost:11434', label: 'Ollama' },
      'openai-compatible': { type: 'openai-compatible', baseUrl: 'https://api.openai.com/v1', apiKey: '', label: 'OpenAI Compatible' },
    }
    const config = configs[type] || configs['ollama']
    setProviderConfig(config)
  }, [])

  const handleConfigChange = useCallback((config: Partial<AIProviderConfig>) => {
    setProviderConfig(prev => ({ ...prev, ...config }))
  }, [])

  const handleSettingsChange = useCallback((settings: Partial<ProviderSettings>) => {
    setProviderSettings(prev => ({ ...prev, ...settings }))
  }, [])

  return (
    <div className="app-layout">
      <Toolbar
        poetryMode={poetryMode}
        onTogglePoetry={() => setPoetryMode(p => !p)}
        onGrammarFix={handleGrammarFix}
        loading={loading}
        hasPendingChanges={documentManager.hasPendingChanges()}
        providerType={providerType}
        onProviderTypeChange={handleProviderTypeChange}
        providerSettings={providerSettings}
        onSettingsChange={handleSettingsChange}
        availableModels={availableModels}
        onRefreshModels={refreshModels}
        onShowSettings={() => setSidebarTab('settings')}
      />

      <div className="main-content">
        <div className="editor-pane">
          <div className="editor-header">
            <span>{poetryMode ? 'Poetry Mode' : 'Markdown Editor'}</span>
            <span>{content.length} chars</span>
          </div>
          <Editor
            content={content}
            onChange={handleContentChange}
            onSelectionChange={handleSelectionChange}
            selectionStart={selectionStart}
            selectionEnd={selectionEnd}
            activeOperation={activeOperation}
            onAcceptHunk={handleAcceptHunk}
            onRejectHunk={handleRejectHunk}
            onAcceptAll={handleAcceptAll}
            onRejectAll={handleRejectAll}
            onRewrite={handleRewrite}
            loading={loading}
          />
        </div>

        <div className="sidebar">
          <div className="sidebar-tabs">
            <button
              className={`sidebar-tab ${sidebarTab === 'settings' ? 'active' : ''}`}
              onClick={() => setSidebarTab('settings')}
            >
              Settings
            </button>
            <button
              className={`sidebar-tab ${sidebarTab === 'history' ? 'active' : ''}`}
              onClick={() => setSidebarTab('history')}
            >
              History
            </button>
            <button
              className={`sidebar-tab ${sidebarTab === 'logs' ? 'active' : ''}`}
              onClick={() => setSidebarTab('logs')}
            >
              Logs
            </button>
          </div>

          {sidebarTab === 'settings' && (
            <Settings
              providerType={providerType}
              providerConfig={providerConfig}
              providerSettings={providerSettings}
              availableModels={availableModels}
              onProviderTypeChange={handleProviderTypeChange}
              onConfigChange={handleConfigChange}
              onSettingsChange={handleSettingsChange}
              onRefreshModels={refreshModels}
            />
          )}
          {sidebarTab === 'history' && (
            <History historyStore={historyStore} />
          )}
          {sidebarTab === 'logs' && (
            <Logs logStore={logStore} />
          )}
        </div>
      </div>

      <div className="status-bar">
        <span className={`status-${statusType}`}>{statusText}</span>
        <span>{providerType} / {providerSettings.model || 'no model'}</span>
      </div>

      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner">Processing...</div>
        </div>
      )}
    </div>
  )
}
