import type { AIProviderConfig, AIResponse, GenerateOptions, ProviderCapabilities, ProviderSettings } from '../types'

export interface AIProvider {
  readonly type: AIProviderConfig['type']
  readonly label: string
  readonly capabilities: ProviderCapabilities

  configure(config: AIProviderConfig): void
  generate(
    systemPrompt: string,
    prompt: string,
    context: string,
    settings: ProviderSettings,
    options?: GenerateOptions
  ): Promise<AIResponse>
  listModels(): Promise<string[]>
  isAvailable(): Promise<boolean>
}

export abstract class BaseAIProvider implements AIProvider {
  abstract readonly type: AIProviderConfig['type']
  abstract readonly label: string
  abstract readonly capabilities: ProviderCapabilities

  abstract configure(config: AIProviderConfig): void
  abstract generate(
    systemPrompt: string,
    prompt: string,
    context: string,
    settings: ProviderSettings,
    options?: GenerateOptions
  ): Promise<AIResponse>
  abstract listModels(): Promise<string[]>
  abstract isAvailable(): Promise<boolean>

  protected parseResponse(raw: string): { text: string; comment: string } {
    try {
      // Models sometimes wrap JSON in markdown code blocks
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
      const parsed = JSON.parse(cleaned) as Record<string, unknown>
      return {
        text: String(parsed.result ?? parsed.text ?? ''),
        comment: String(parsed.comment ?? ''),
      }
    } catch {
      // Fallback for models that ignore format instructions
      const commentMatch = raw.match(/\[COMMENT\]([\s\S]*?)(?:\[\/COMMENT\]|$)/)
      const comment = commentMatch ? commentMatch[1].trim() : ''
      const text = raw.replace(/\[COMMENT\][\s\S]*?(\[\/COMMENT\]|$)/, '').trim()
      return { text, comment }
    }
  }
}
