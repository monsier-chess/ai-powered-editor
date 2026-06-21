import { AIOperation } from './AIOperation'
import type { AIOperationResult, OperationType } from '../types'
import { PromptRegistry } from '../prompts/PromptRegistry'
import { DiffEngine } from '../diff/DiffEngine'
import { LogStore } from '../logging/LogStore'

const MAX_LENGTH_CHANGE_RATIO = 1.5

export class GrammarFixOperation extends AIOperation {
  protected readonly type: OperationType = 'grammar-fix'
  protected readonly promptKey: OperationType = 'grammar-fix'

  constructor(
    promptRegistry: PromptRegistry,
    diffEngine: DiffEngine,
    logStore: LogStore
  ) {
    super(promptRegistry, diffEngine, logStore)
  }

  prepareContext(fullText: string, selection?: { start: number; end: number }): string {
    if (selection) {
      return fullText.slice(selection.start, selection.end)
    }
    return fullText
  }

  validateResult(result: AIOperationResult): { valid: boolean; warning?: string } {
    const analysis = this.diffEngine.analyzeDiff(result.originalText, result.modifiedText)

    if (analysis.isSuspicious) {
      return {
        valid: false,
        warning: analysis.warning || 'Suspicious text length change detected.',
      }
    }

    return { valid: true }
  }
}
