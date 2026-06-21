import { useState, useCallback, useEffect, useRef } from 'react'
import { DocumentManager } from '../core/document/DocumentManager'
import { DiffEngine } from '../core/diff/DiffEngine'
import { PromptRegistry } from '../core/prompts/PromptRegistry'
import { HistoryStore } from '../core/history/HistoryStore'
import { LogStore } from '../core/logging/LogStore'
import { ProviderRegistry } from '../core/providers/ProviderRegistry'
import { TextChunker } from '../core/text/TextChunker'

import { GrammarFixOperation } from '../core/operations/GrammarFixOperation'
import { RewriteOperation } from '../core/operations/RewriteOperation'
import { PoetryGrammarFixOperation } from '../core/operations/PoetryGrammarFixOperation'
import { Toolbar } from './Toolbar/Toolbar'
import { Editor } from './Editor/Editor'
import { Settings } from './Settings/Settings'
import { History } from './History/History'
import { Logs } from './Logs/Logs'
import type { AIOperationResult, AIProviderConfig, ProcessingSettings, ProviderSettings } from '../core/types'
import type { AIProvider } from '../core/providers/AIProvider'

type SidebarTab = 'settings' | 'history' | 'logs'

const DEFAULT_SETTINGS: ProviderSettings = {
  model: '',
  temperature: 0.1,
  maxTokens: 4096,
  thinking: false,
}

const DEFAULT_PROCESSING: ProcessingSettings = {
  chunkSize: 3000,
  chunkOverlap: 300,
  inactivityTimeout: 60,
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
  const [textChunker] = useState(() => new TextChunker())

  const [content, setContent] = useState(documentManager.getContent())
  const [activeOperation, setActiveOperation] = useState<AIOperationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [statusText, setStatusText] = useState('Ready')
  const [statusType, setStatusType] = useState<'info' | 'success' | 'error' | 'warning'>('info')
  // null = single-chunk / not processing; {current, total} = chunked progress
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)

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
  const [processingSettings, setProcessingSettings] = useState<ProcessingSettings>(DEFAULT_PROCESSING)
  const [availableModels, setAvailableModels] = useState<string[]>([])

  const abortControllerRef = useRef<AbortController | null>(null)

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

  const handleCancel = useCallback(() => {
    abortControllerRef.current?.abort()
  }, [])

  const handleGrammarFix = useCallback(async () => {
    if (documentManager.hasPendingChanges()) {
      setStatus('Accept or reject pending changes first.', 'warning')
      return
    }

    const hasSelection = selectionStart !== selectionEnd
    const fullText = hasSelection
      ? content.slice(selectionStart, selectionEnd)
      : content

    if (!fullText.trim()) {
      setStatus('No text to process.', 'warning')
      return
    }

    const ac = new AbortController()
    abortControllerRef.current = ac

    setLoading(true)
    setProgress(null)

    const op = poetryMode ? poetryFixOp.current : grammarFixOp.current
    const provider = getProvider()
    const inactivityTimeoutMs = processingSettings.inactivityTimeout * 1000

    const onToken = () => {
      // called for every streamed token — keeps inactivity timer reset
    }

    try {
      const useChunking = processingSettings.chunkSize > 0 && fullText.length > processingSettings.chunkSize

      if (!useChunking) {
        setStatus('Running grammar fix...', 'info')

        const context = op.prepareContext(content, hasSelection ? { start: selectionStart, end: selectionEnd } : undefined)

        const result = await op.execute(provider, fullText, context, providerSettings, {}, {
          signal: ac.signal,
          onToken,
          inactivityTimeoutMs,
        })
        result.contentStart = hasSelection ? selectionStart : 0

        documentManager.applyOperationResult(result)
        historyStore.add(result)
        setActiveOperation(result)
        setStatus(`Grammar fix complete: ${result.comment || 'No comment'}`, 'success')
      } else {
        // --- chunked path ---
        const chunks = textChunker.split(fullText, processingSettings.chunkSize)
        setProgress({ current: 0, total: chunks.length })
        setStatus(`Processing chunk 1/${chunks.length}...`, 'info')

        const modifiedChunks: string[] = []
        let comments: string[] = []
        let precedingOutput = ''

        for (let i = 0; i < chunks.length; i++) {
          if (ac.signal.aborted) throw ac.signal.reason

          setProgress({ current: i + 1, total: chunks.length })
          setStatus(`Processing chunk ${i + 1}/${chunks.length}...`, 'info')

          const chunk = chunks[i]

          // Preceding context = last N chars of previous chunk's FIXED output
          const chunkContext = precedingOutput.length > 0
            ? `[Preceding context — for reference only, do NOT include in output]\n${precedingOutput.slice(-processingSettings.chunkOverlap)}`
            : ''

          const result = await op.execute(
            provider,
            chunk.text,
            chunkContext,
            providerSettings,
            {},
            { signal: ac.signal, onToken, inactivityTimeoutMs }
          )

          modifiedChunks.push(result.modifiedText)
          precedingOutput = result.modifiedText
          if (result.comment) comments.push(result.comment)
        }

        // Merge chunks back and compute a single diff against the full original
        const combinedModified = modifiedChunks.join('')
        const hunks = diffEngine.computeHunks(fullText, combinedModified)
        const mergedComment = comments.join(' | ') || `Processed ${chunks.length} chunks`

        const merged: AIOperationResult = {
          id: crypto.randomUUID(),
          type: poetryMode ? 'poetry-grammar-fix' : 'grammar-fix',
          originalText: fullText,
          modifiedText: combinedModified,
          hunks,
          comment: mergedComment,
          timestamp: Date.now(),
          accepted: null,
          contentStart: hasSelection ? selectionStart : 0,
        }

        documentManager.applyOperationResult(merged)
        historyStore.add(merged)
        setActiveOperation(merged)
        setStatus(`Grammar fix complete (${chunks.length} chunks): ${mergedComment}`, 'success')
      }
    } catch (err) {
      if (ac.signal.aborted) {
        setStatus('Grammar fix cancelled.', 'info')
      } else {
        setStatus(`Grammar fix failed: ${err}`, 'error')
      }
    } finally {
      abortControllerRef.current = null
      setLoading(false)
      setProgress(null)
    }
  }, [
    content, selectionStart, selectionEnd, poetryMode,
    documentManager, diffEngine, getProvider,
    providerSettings, processingSettings,
    historyStore, textChunker, setStatus,
  ])

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

    const ac = new AbortController()
    abortControllerRef.current = ac

    setLoading(true)
    setProgress(null)
    setStatus('Running rewrite...', 'info')

    try {
      const op = rewriteOp.current
      const context = op.prepareContext(content, { start: selectionStart, end: selectionEnd })
      const provider = getProvider()

      const result = await op.execute(provider, text, context, providerSettings, { instruction }, {
        signal: ac.signal,
        onToken: () => {},
        inactivityTimeoutMs: processingSettings.inactivityTimeout * 1000,
      })
      result.contentStart = selectionStart

      documentManager.applyOperationResult(result)
      historyStore.add(result)
      setActiveOperation(result)
      setStatus(`Rewrite complete: ${result.comment || 'No comment'}`, 'success')
    } catch (err) {
      if (ac.signal.aborted) {
        setStatus('Rewrite cancelled.', 'info')
      } else {
        setStatus(`Rewrite failed: ${err}`, 'error')
      }
    } finally {
      abortControllerRef.current = null
      setLoading(false)
      setProgress(null)
    }
  }, [content, selectionStart, selectionEnd, documentManager, getProvider, providerSettings, processingSettings, historyStore, setStatus])

  const handleAcceptHunk = useCallback((hunkId: string) => {
    if (!activeOperation) return
    documentManager.acceptHunk(activeOperation.id, hunkId)
    setContent(documentManager.getContent())

    const updated = documentManager.getActiveOperations().find(o => o.id === activeOperation.id)
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

  const handleProcessingSettingsChange = useCallback((settings: Partial<ProcessingSettings>) => {
    setProcessingSettings(prev => ({ ...prev, ...settings }))
  }, [])

  const progressPercent = progress ? Math.round((progress.current / progress.total) * 100) : 0

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
              processingSettings={processingSettings}
              availableModels={availableModels}
              onProviderTypeChange={handleProviderTypeChange}
              onConfigChange={handleConfigChange}
              onSettingsChange={handleSettingsChange}
              onProcessingSettingsChange={handleProcessingSettingsChange}
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
        {loading && (
          <div className="status-progress-track">
            {progress ? (
              <div
                className="status-progress-fill"
                style={{ width: `${progressPercent}%` }}
              />
            ) : (
              <div className="status-progress-indeterminate" />
            )}
          </div>
        )}
        <div className="status-bar-content">
          <span className={`status-${statusType}`}>{statusText}</span>
          <div className="status-bar-right">
            {loading && (
              <button className="status-cancel-btn" onClick={handleCancel} title="Cancel operation">
                ✕ Cancel
              </button>
            )}
            {progress && (
              <span className="status-progress-label">{progress.current}/{progress.total}</span>
            )}
            <span>{providerType} / {providerSettings.model || 'no model'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
