import { AIOperation } from './AIOperation'
import type { AIOperationResult, OperationType } from '../types'
import { PromptRegistry } from '../prompts/PromptRegistry'
import { DiffEngine } from '../diff/DiffEngine'
import { LogStore } from '../logging/LogStore'

export class PoetryGrammarFixOperation extends AIOperation {
  protected readonly type: OperationType = 'poetry-grammar-fix'
  protected readonly promptKey: OperationType = 'poetry-grammar-fix'

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
    const origLines = result.originalText.split('\n')
    const modLines = result.modifiedText.split('\n')

    if (origLines.length !== modLines.length) {
      return {
        valid: false,
        warning: `Line count changed: ${origLines.length} → ${modLines.length}. Lines must be preserved.`,
      }
    }

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
