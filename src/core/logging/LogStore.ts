import type { LogEntry } from '../types'

export class LogStore {
  private entries: LogEntry[] = []
  private maxEntries: number = 1000

  constructor(maxEntries = 1000) {
    this.maxEntries = maxEntries
  }

  add(entry: LogEntry): void {
    this.entries.push(entry)
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries)
    }
  }

  getAll(): LogEntry[] {
    return [...this.entries]
  }

  getByOperationType(type: string): LogEntry[] {
    return this.entries.filter(e => e.operationType === type)
  }

  clear(): void {
    this.entries = []
  }
}
