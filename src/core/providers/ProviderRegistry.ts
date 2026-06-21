import type { AIProvider } from './AIProvider'
import { OllamaProvider } from './OllamaProvider'
import { OpenAICompatibleProvider } from './OpenAICompatibleProvider'

type ProviderConstructor = new () => AIProvider

export class ProviderRegistry {
  private providers: Map<string, AIProvider> = new Map()
  private constructors: Map<string, ProviderConstructor> = new Map()

  constructor() {
    this.register('ollama', OllamaProvider)
    this.register('openai-compatible', OpenAICompatibleProvider)
  }

  register(type: string, ctor: ProviderConstructor): void {
    this.constructors.set(type, ctor)
  }

  get(type: string): AIProvider | undefined {
    return this.providers.get(type)
  }

  create(type: string): AIProvider {
    const ctor = this.constructors.get(type)
    if (!ctor) {
      throw new Error(`Unknown provider type: ${type}`)
    }
    const provider = new ctor()
    this.providers.set(type, provider)
    return provider
  }

  listAvailable(): string[] {
    return Array.from(this.constructors.keys())
  }

  listConfigured(): string[] {
    return Array.from(this.providers.keys())
  }
}
