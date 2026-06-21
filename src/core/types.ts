export type OperationType = 'grammar-fix' | 'rewrite' | 'poetry-grammar-fix'

export interface ProviderSettings {
  model: string
  temperature: number
  maxTokens: number
  thinking: boolean
}

export interface DiffSegment {
  type: 'equal' | 'added' | 'removed'
  text: string
}

export interface DiffLineWithSegments {
  line: string
  segments: DiffSegment[]
}

export interface DiffHunk {
  id: string
  oldStart: number
  oldLines: string[]
  oldLinesWithSegments: DiffLineWithSegments[]
  newStart: number
  newLines: string[]
  newLinesWithSegments: DiffLineWithSegments[]
  accepted: boolean | null
}

export interface AIOperationResult {
  id: string
  type: OperationType
  originalText: string
  modifiedText: string
  hunks: DiffHunk[]
  comment: string
  timestamp: number
  accepted: boolean | null
  // character offset in the full document where originalText starts
  contentStart: number
}

export interface AIRequest {
  prompt: string
  systemPrompt: string
  context: string
  settings: ProviderSettings
}

export interface AIResponse {
  text: string
  comment: string
  raw: string
}

export interface LogEntry {
  id: string
  timestamp: number
  provider: string
  model: string
  operationType: OperationType
  prompt: string
  systemPrompt: string
  request: string
  response: string
  comment: string
  diff: string
}

export interface HistoryEntry {
  id: string
  timestamp: number
  operationType: OperationType
  comment: string
  result: AIOperationResult
}

export interface ProviderCapabilities {
  supportsThinking: boolean
  supportsStreaming: boolean
  maxContextLength: number
}

export interface ProcessingSettings {
  chunkSize: number        // chars per chunk; 0 = no chunking
  chunkOverlap: number     // chars of preceding context sent with each chunk
  inactivityTimeout: number // seconds of silence before aborting
}

export interface GenerateOptions {
  signal?: AbortSignal
  onToken?: () => void          // called on every token received (for inactivity reset + UX)
  inactivityTimeoutMs?: number  // overrides provider default when set
}

export interface AIProviderConfig {
  type: 'ollama' | 'openai-compatible' | 'openai' | 'anthropic' | 'gemini' | 'openrouter'
  baseUrl?: string
  apiKey?: string
  label: string
}

export type STTProviderType = 'web-speech' | 'local-whisper' | 'openai-compatible'

export interface STTSettings {
  provider: STTProviderType
  language: string           // ISO 639-1, e.g. 'ru'
  localWhisperUrl: string    // e.g. 'http://localhost:8000'
  openAIBaseUrl: string      // e.g. 'http://localhost:8000/v1'
  openAIApiKey: string
}

export const DEFAULT_STT_SETTINGS: STTSettings = {
  provider: 'web-speech',
  language: 'ru',
  localWhisperUrl: 'http://localhost:8000',
  openAIBaseUrl: 'http://localhost:8000/v1',
  openAIApiKey: '',
}
