import { BaseAIProvider } from './AIProvider'
import type { AIProviderConfig, AIResponse, ProviderCapabilities, ProviderSettings } from '../types'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatRequest {
  model: string
  messages: ChatMessage[]
  temperature: number
  max_tokens: number
  stream: boolean
  response_format: { type: 'json_object' }
}

interface ChatResponse {
  choices: {
    message: {
      content: string
    }
    finish_reason: string
  }[]
}

const DEFAULT_OPENAI_URL = 'https://api.openai.com/v1'

export class OpenAICompatibleProvider extends BaseAIProvider {
  readonly type = 'openai-compatible' as const
  readonly label = 'OpenAI Compatible'
  readonly capabilities: ProviderCapabilities = {
    supportsThinking: false,
    supportsStreaming: true,
    maxContextLength: 128000,
  }

  private baseUrl: string = DEFAULT_OPENAI_URL
  private apiKey: string = ''

  configure(config: AIProviderConfig): void {
    this.baseUrl = (config.baseUrl || DEFAULT_OPENAI_URL).replace(/\/$/, '')
    this.apiKey = config.apiKey || ''
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {},
        signal: AbortSignal.timeout(5000),
      })
      return res.ok
    } catch {
      return false
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {},
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) throw new Error(`API returned ${res.status}`)
      const data = await res.json()
      return (data.data as { id: string }[]).map(m => m.id)
    } catch (err) {
      throw new Error(`Failed to list models: ${err}`)
    }
  }

  async generate(
    systemPrompt: string,
    prompt: string,
    context: string,
    settings: ProviderSettings
  ): Promise<AIResponse> {
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: context ? `${prompt}\n\n---\n\n${context}` : prompt,
      },
    ]

    const body: ChatRequest = {
      model: settings.model,
      messages,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      stream: false,
      response_format: { type: 'json_object' },
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`API chat completion failed: ${res.status} — ${errText}`)
    }

    const data = (await res.json()) as ChatResponse
    const raw = data.choices[0]?.message?.content || ''
    const { text, comment } = this.parseResponse(raw)
    return { text, comment, raw }
  }
}
