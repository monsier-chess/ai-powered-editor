import { AIOperation } from './AIOperation'
import type { AIOperationResult, OperationType } from '../types'
import { PromptRegistry } from '../prompts/PromptRegistry'
import { DiffEngine } from '../diff/DiffEngine'
import { LogStore } from '../logging/LogStore'

const CONTEXT_LIMIT = 2000
const CONTEXT_BEFORE_LINES = 3
const CONTEXT_AFTER_LINES = 3

export class RewriteOperation extends AIOperation {
  protected readonly type: OperationType = 'rewrite'
  protected readonly promptKey: OperationType = 'rewrite'

  constructor(
    promptRegistry: PromptRegistry,
    diffEngine: DiffEngine,
    logStore: LogStore
  ) {
    super(promptRegistry, diffEngine, logStore)
  }

  prepareContext(fullText: string, selection?: { start: number; end: number }): string {
    if (!selection) return ''

    const before = fullText.slice(0, selection.start)
    const after = fullText.slice(selection.end)

    const beforeLines = before.split('\n')
    const afterLines = after.split('\n')

    const contextBefore = beforeLines.slice(-CONTEXT_BEFORE_LINES).join('\n')
    const contextAfter = afterLines.slice(0, CONTEXT_AFTER_LINES).join('\n')

    if (!contextBefore && !contextAfter) return ''

    // Only surrounding lines — the selected text itself is already in the main prompt
    let context = ''
    if (contextBefore) context += `[Before selection]\n${contextBefore}\n`
    context += '[← selection goes here →]'
    if (contextAfter) context += `\n[After selection]\n${contextAfter}`

    return context.length > CONTEXT_LIMIT ? context.slice(0, CONTEXT_LIMIT) : context
  }

  validateResult(_result: AIOperationResult): { valid: boolean; warning?: string } {
    return { valid: true }
  }
}
