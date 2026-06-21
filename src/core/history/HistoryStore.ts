import type { HistoryEntry, AIOperationResult } from '../types'

export class HistoryStore {
  private entries: HistoryEntry[] = []

  add(result: AIOperationResult): void {
    this.entries.push({
      id: result.id,
      timestamp: result.timestamp,
      operationType: result.type,
      comment: result.comment,
      result,
    })
  }

  getAll(): HistoryEntry[] {
    return [...this.entries]
  }

  getLast(n: number): HistoryEntry[] {
    return this.entries.slice(-n).reverse()
  }

  clear(): void {
    this.entries = []
  }
}
