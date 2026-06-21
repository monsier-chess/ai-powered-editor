import { BaseAIProvider } from './AIProvider'
import type { AIProviderConfig, AIResponse, ProviderCapabilities, ProviderSettings } from '../types'

interface OllamaModel {
  name: string
  modified_at: string
  size: number
}

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    result: { type: 'string' },
    comment: { type: 'string' },
  },
  required: ['result', 'comment'],
}

interface OllamaGenerateRequest {
  model: string
  prompt: string
  system: string
  stream: boolean
  think: boolean
  format: typeof RESPONSE_SCHEMA
  options: {
    temperature: number
    num_predict: number
  }
}

interface OllamaGenerateResponse {
  model: string
  response: string
  thinking?: string
  done: boolean
}

const DEFAULT_OLLAMA_URL = 'http://localhost:11434'

export class OllamaProvider extends BaseAIProvider {
  readonly type = 'ollama' as const
  readonly label = 'Ollama'
  readonly capabilities: ProviderCapabilities = {
    supportsThinking: false,
    supportsStreaming: true,
    maxContextLength: 8192,
  }

  private baseUrl: string = DEFAULT_OLLAMA_URL

  configure(config: AIProviderConfig): void {
    this.baseUrl = (config.baseUrl || DEFAULT_OLLAMA_URL).replace(/\/$/, '')
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      })
      return res.ok
    } catch {
      return false
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) throw new Error(`Ollama returned ${res.status}`)
      const data = await res.json()
      return (data.models as OllamaModel[]).map(m => m.name)
    } catch (err) {
      throw new Error(`Failed to list Ollama models: ${err}`)
    }
  }

  async generate(
    systemPrompt: string,
    prompt: string,
    context: string,
    settings: ProviderSettings
  ): Promise<AIResponse> {
    const fullPrompt = context
      ? `${prompt}\n\n---\n\n${context}`
      : prompt

    const body: OllamaGenerateRequest = {
      model: settings.model,
      prompt: fullPrompt,
      system: systemPrompt,
      stream: false,
      think: settings.thinking,
      format: RESPONSE_SCHEMA,
      options: {
        temperature: settings.temperature,
        num_predict: settings.maxTokens,
      },
    }

    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Ollama generate failed: ${res.status} — ${errText}`)
    }

    const data = (await res.json()) as OllamaGenerateResponse
    const raw = data.response || ''

    if (!raw.trim()) {
      if (settings.thinking && data.thinking) {
        throw new Error(
          'Model ran out of tokens while thinking. Increase max tokens or disable thinking mode in settings.'
        )
      }
      throw new Error('Ollama returned an empty response. Check that the model is loaded and try again.')
    }

    const { text, comment } = this.parseResponse(raw)
    return { text, comment, raw }
  }
}
