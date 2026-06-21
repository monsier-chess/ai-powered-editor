import { diffLines } from 'diff'
import { v4 as uuid } from 'uuid'
import type { DiffHunk } from '../types'

const SUSPICIOUS_LENGTH_THRESHOLD = 1.5

export interface DiffAnalysis {
  originalLength: number
  modifiedLength: number
  ratio: number
  isSuspicious: boolean
  warning: string | null
}

export class DiffEngine {
  computeHunks(original: string, modified: string): DiffHunk[] {
    const changes = diffLines(original, modified)
    const hunks: DiffHunk[] = []
    let oldLine = 1
    let newLine = 1
    let currentHunk: {
      oldStart: number
      oldLines: string[]
      newStart: number
      newLines: string[]
    } | null = null

    for (const change of changes) {
      const lines = change.value.replace(/\n$/, '').split('\n')

      if (change.added) {
        if (!currentHunk) {
          currentHunk = {
            oldStart: oldLine,
            oldLines: [],
            newStart: newLine,
            newLines: [],
          }
        }
        currentHunk.newLines.push(...lines)
        newLine += lines.length
      } else if (change.removed) {
        if (!currentHunk) {
          currentHunk = {
            oldStart: oldLine,
            oldLines: [],
            newStart: newLine,
            newLines: [],
          }
        }
        currentHunk.oldLines.push(...lines)
        oldLine += lines.length
      } else {
        if (currentHunk) {
          hunks.push({
            id: uuid(),
            oldStart: currentHunk.oldStart,
            oldLines: currentHunk.oldLines,
            newStart: currentHunk.newStart,
            newLines: currentHunk.newLines,
            accepted: null,
          })
          currentHunk = null
        }
        oldLine += lines.length
        newLine += lines.length
      }
    }

    if (currentHunk) {
      hunks.push({
        id: uuid(),
        oldStart: currentHunk.oldStart,
        oldLines: currentHunk.oldLines,
        newStart: currentHunk.newStart,
        newLines: currentHunk.newLines,
        accepted: null,
      })
    }

    return hunks
  }

  analyzeDiff(original: string, modified: string): DiffAnalysis {
    const originalLength = original.length
    const modifiedLength = modified.length
    const ratio = originalLength > 0 ? modifiedLength / originalLength : 1

    let warning: string | null = null
    if (ratio > SUSPICIOUS_LENGTH_THRESHOLD || ratio < 1 / SUSPICIOUS_LENGTH_THRESHOLD) {
      warning = `Suspicious text length change: ${originalLength} → ${modifiedLength} chars (${(ratio * 100).toFixed(0)}%). Expected ratio < ${SUSPICIOUS_LENGTH_THRESHOLD}.`
    }

    return {
      originalLength,
      modifiedLength,
      ratio,
      isSuspicious: warning !== null,
      warning,
    }
  }
}
