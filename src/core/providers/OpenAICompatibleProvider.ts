import { BaseAIProvider } from './AIProvider'
import type { AIProviderConfig, AIResponse, GenerateOptions, ProviderCapabilities, ProviderSettings } from '../types'

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

function combineSignals(...signals: (AbortSignal | undefined)[]): AbortSignal {
  const valid = signals.filter((s): s is AbortSignal => s !== undefined)
  if (valid.length === 0) return new AbortController().signal
  if (valid.length === 1) return valid[0]
  if (typeof AbortSignal.any === 'function') return AbortSignal.any(valid)
  const ac = new AbortController()
  for (const s of valid) {
    if (s.aborted) { ac.abort(s.reason); break }
    s.addEventListener('abort', () => ac.abort(s.reason), { once: true })
  }
  return ac.signal
}

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
    settings: ProviderSettings,
    options?: GenerateOptions
  ): Promise<AIResponse> {
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: context ? `${prompt}\n\n---\n\n${context}` : prompt,
      },
    ]

    const useStreaming = !!options?.onToken
    const inactivityMs = options?.inactivityTimeoutMs ?? 120000

    const body: ChatRequest = {
      model: settings.model,
      messages,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      stream: useStreaming,
      response_format: { type: 'json_object' },
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`

    // Inactivity controller — resets on each received token
    const inactivityAc = new AbortController()
    let inactivityTimer: ReturnType<typeof setTimeout> | undefined
    const ping = () => {
      clearTimeout(inactivityTimer)
      inactivityTimer = setTimeout(
        () => inactivityAc.abort(new DOMException('signal timed out', 'TimeoutError')),
        inactivityMs
      )
    }
    ping()

    const signal = combineSignals(inactivityAc.signal, options?.signal)

    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal,
      })

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`API chat completion failed: ${res.status} — ${errText}`)
      }

      if (!useStreaming) {
        clearTimeout(inactivityTimer)
        const data = (await res.json()) as ChatResponse
        const raw = data.choices[0]?.message?.content || ''
        const { text, comment } = this.parseResponse(raw)
        return { text, comment, raw }
      }

      // Streaming path — accumulate tokens, call onToken for each
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      let buffer = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          ping() // reset inactivity timer on any data
          buffer += decoder.decode(value, { stream: true })

          const lines = buffer.split('\n')
          buffer = lines.pop() ?? '' // keep incomplete last line

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data) as {
                choices?: Array<{ delta?: { content?: string } }>
              }
              const delta = parsed.choices?.[0]?.delta?.content ?? ''
              if (delta) {
                accumulated += delta
                options!.onToken!()
              }
            } catch {
              // ignore malformed SSE lines
            }
          }
        }
      } finally {
        clearTimeout(inactivityTimer)
        reader.releaseLock()
      }

      const { text, comment } = this.parseResponse(accumulated)
      return { text, comment, raw: accumulated }
    } catch (err) {
      clearTimeout(inactivityTimer)
      throw err
    }
  }
}
