import { BaseAIProvider } from './AIProvider'
import type { AIProviderConfig, AIResponse, GenerateOptions, ProviderCapabilities, ProviderSettings } from '../types'

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
    settings: ProviderSettings,
    options?: GenerateOptions
  ): Promise<AIResponse> {
    const fullPrompt = context ? `${prompt}\n\n---\n\n${context}` : prompt

    const useStreaming = !!options?.onToken
    const inactivityMs = options?.inactivityTimeoutMs ?? 120000

    const body: OllamaGenerateRequest = {
      model: settings.model,
      prompt: fullPrompt,
      system: systemPrompt,
      stream: useStreaming,
      think: settings.thinking,
      format: RESPONSE_SCHEMA,
      options: {
        temperature: settings.temperature,
        num_predict: settings.maxTokens,
      },
    }

    // Inactivity controller
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
      const res = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      })

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`Ollama generate failed: ${res.status} — ${errText}`)
      }

      if (!useStreaming) {
        clearTimeout(inactivityTimer)
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

      // Streaming path — Ollama sends NDJSON lines
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      let buffer = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          ping()
          buffer += decoder.decode(value, { stream: true })

          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed) continue

            try {
              const parsed = JSON.parse(trimmed) as OllamaGenerateResponse
              if (parsed.response) {
                accumulated += parsed.response
                options!.onToken!()
              }
              if (parsed.done) break
            } catch {
              // ignore malformed lines
            }
          }
        }
      } finally {
        clearTimeout(inactivityTimer)
        reader.releaseLock()
      }

      if (!accumulated.trim()) {
        throw new Error('Ollama returned an empty response. Check that the model is loaded and try again.')
      }

      const { text, comment } = this.parseResponse(accumulated)
      return { text, comment, raw: accumulated }
    } catch (err) {
      clearTimeout(inactivityTimer)
      throw err
    }
  }
}
