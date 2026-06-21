import type { AIOperationResult, DiffHunk } from '../types'

export class DocumentManager {
  private content: string
  private activeOperations: Map<string, AIOperationResult> = new Map()
  private pendingChanges: boolean = false

  constructor(initialContent = '') {
    this.content = initialContent
  }

  getContent(): string {
    return this.content
  }

  setContent(content: string): void {
    this.content = content
  }

  getActiveOperations(): AIOperationResult[] {
    return Array.from(this.activeOperations.values())
  }

  hasPendingChanges(): boolean {
    return this.pendingChanges
  }

  applyOperationResult(result: AIOperationResult): void {
    this.activeOperations.set(result.id, result)
    this.pendingChanges = true
  }

  acceptHunk(operationId: string, hunkId: string): boolean {
    const op = this.activeOperations.get(operationId)
    if (!op) return false

    const hunkIdx = op.hunks.findIndex(h => h.id === hunkId)
    if (hunkIdx === -1) return false

    const hunk = op.hunks[hunkIdx]

    // Apply the hunk to op.originalText, then update the full content
    const originalLines = op.originalText.split('\n')
    originalLines.splice(hunk.oldStart - 1, hunk.oldLines.length, ...hunk.newLines)
    const newOriginalText = originalLines.join('\n')

    this.content =
      this.content.slice(0, op.contentStart) +
      newOriginalText +
      this.content.slice(op.contentStart + op.originalText.length)

    op.originalText = newOriginalText

    // Remove the decided hunk
    op.hunks.splice(hunkIdx, 1)

    // Shift subsequent hunk positions by the line delta
    const delta = hunk.newLines.length - hunk.oldLines.length
    if (delta !== 0) {
      for (let i = hunkIdx; i < op.hunks.length; i++) {
        op.hunks[i].oldStart += delta
        op.hunks[i].newStart += delta
      }
    }

    if (op.hunks.length === 0) {
      this.closeOperation(operationId)
    }

    return true
  }

  rejectHunk(operationId: string, hunkId: string): boolean {
    const op = this.activeOperations.get(operationId)
    if (!op) return false

    const hunkIdx = op.hunks.findIndex(h => h.id === hunkId)
    if (hunkIdx === -1) return false

    // Rejection: discard the proposed change, original text stays
    op.hunks.splice(hunkIdx, 1)

    if (op.hunks.length === 0) {
      this.closeOperation(operationId)
    }

    return true
  }

  acceptAll(operationId: string): void {
    const op = this.activeOperations.get(operationId)
    if (!op) return

    // Apply all hunks to originalText in reverse order to keep indices stable
    const sortedHunks = [...op.hunks].sort((a, b) => b.oldStart - a.oldStart)
    const originalLines = op.originalText.split('\n')
    for (const hunk of sortedHunks) {
      originalLines.splice(hunk.oldStart - 1, hunk.oldLines.length, ...hunk.newLines)
    }
    const newOriginalText = originalLines.join('\n')

    this.content =
      this.content.slice(0, op.contentStart) +
      newOriginalText +
      this.content.slice(op.contentStart + op.originalText.length)

    op.hunks = []
    this.closeOperation(operationId)
  }

  rejectAll(operationId: string): void {
    const op = this.activeOperations.get(operationId)
    if (!op) return

    op.hunks = []
    this.closeOperation(operationId)
  }

  private closeOperation(operationId: string): void {
    this.activeOperations.delete(operationId)
    this.pendingChanges = this.activeOperations.size > 0
  }
}
