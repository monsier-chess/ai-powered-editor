export type OperationType = 'grammar-fix' | 'rewrite' | 'poetry-grammar-fix'

export interface ProviderSettings {
  model: string
  temperature: number
  maxTokens: number
  thinking: boolean
}

export interface DiffHunk {
  id: string
  oldStart: number
  oldLines: string[]
  newStart: number
  newLines: string[]
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

export interface AIProviderConfig {
  type: 'ollama' | 'openai-compatible' | 'openai' | 'anthropic' | 'gemini' | 'openrouter'
  baseUrl?: string
  apiKey?: string
  label: string
}
