import type { AIOperationResult, OperationType, ProviderSettings } from '../types'
import type { AIProvider } from '../providers/AIProvider'
import { PromptRegistry } from '../prompts/PromptRegistry'
import { DiffEngine } from '../diff/DiffEngine'
import { LogStore } from '../logging/LogStore'

export abstract class AIOperation {
  protected abstract readonly type: OperationType
  protected abstract readonly promptKey: OperationType

  protected promptRegistry: PromptRegistry
  protected diffEngine: DiffEngine
  protected logStore: LogStore

  constructor(
    promptRegistry: PromptRegistry,
    diffEngine: DiffEngine,
    logStore: LogStore
  ) {
    this.promptRegistry = promptRegistry
    this.diffEngine = diffEngine
    this.logStore = logStore
  }

  abstract prepareContext(fullText: string, selection?: { start: number; end: number }): string

  abstract validateResult(result: AIOperationResult): { valid: boolean; warning?: string }

  async execute(
    provider: AIProvider,
    text: string,
    context: string,
    settings: ProviderSettings,
    additionalVars: Record<string, string> = {}
  ): Promise<AIOperationResult> {
    const { systemPrompt, userPrompt } = this.promptRegistry.buildPrompt(this.promptKey, {
      text,
      ...additionalVars,
    })

    const response = await provider.generate(systemPrompt, userPrompt, context, settings)

    const modifiedText = response.text

    const analysis = this.diffEngine.analyzeDiff(text, modifiedText)
    const hunks = this.diffEngine.computeHunks(text, modifiedText)

    const result: AIOperationResult = {
      id: crypto.randomUUID(),
      type: this.type,
      originalText: text,
      modifiedText,
      hunks,
      comment: response.comment,
      timestamp: Date.now(),
      accepted: null,
      contentStart: 0, // caller should override for selection-based operations
    }

    const validation = this.validateResult(result)

    this.logStore.add({
      id: result.id,
      timestamp: result.timestamp,
      provider: provider.type,
      model: settings.model,
      operationType: this.type,
      prompt: userPrompt,
      systemPrompt,
      request: JSON.stringify({ text, context }),
      response: response.raw,
      comment: response.comment,
      diff: JSON.stringify(hunks),
    })

    if (!validation.valid) {
      result.comment = (result.comment ? result.comment + ' ' : '') + `WARNING: ${validation.warning}`
    }

    return result
  }
}
