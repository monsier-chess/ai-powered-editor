import { diffLines, diffWords, diffChars } from 'diff'
import { v4 as uuid } from 'uuid'
import type { DiffHunk, DiffLineWithSegments, DiffSegment } from '../types'

const SUSPICIOUS_LENGTH_THRESHOLD = 1.5

export interface DiffAnalysis {
  originalLength: number
  modifiedLength: number
  ratio: number
  isSuspicious: boolean
  warning: string | null
}

export class DiffEngine {
  private computeLineSegments(oldLine: string, newLine: string): { oldSegments: DiffLineWithSegments; newSegments: DiffLineWithSegments } {
    const changes = diffWords(oldLine, newLine, { ignoreWhitespace: false })
    const oldSegments: DiffLineWithSegments = { line: oldLine, segments: [] }
    const newSegments: DiffLineWithSegments = { line: newLine, segments: [] }

    for (const change of changes) {
      if (change.added) {
        newSegments.segments.push({ type: 'added', text: change.value })
      } else if (change.removed) {
        oldSegments.segments.push({ type: 'removed', text: change.value })
      } else {
        oldSegments.segments.push({ type: 'equal', text: change.value })
        newSegments.segments.push({ type: 'equal', text: change.value })
      }
    }

    return { oldSegments, newSegments }
  }

  // Splits a flat list of diff segments back into per-line structures.
  // Newline characters within any segment type act as line separators.
  private splitByNewlines(segments: DiffSegment[], lines: string[]): DiffLineWithSegments[] {
    const result: DiffLineWithSegments[] = []
    let current: DiffSegment[] = []
    let lineIdx = 0

    for (const seg of segments) {
      const parts = seg.text.split('\n')

      for (let i = 0; i < parts.length; i++) {
        if (parts[i].length > 0) {
          current.push({ type: seg.type, text: parts[i] })
        }

        if (i < parts.length - 1) {
          result.push({ line: lines[lineIdx] ?? '', segments: current })
          lineIdx++
          current = []
        }
      }
    }

    if (lineIdx < lines.length) {
      result.push({ line: lines[lineIdx], segments: current })
    }

    return result
  }

  private buildHunk(hunk: {
    oldStart: number
    oldLines: string[]
    newStart: number
    newLines: string[]
  }): DiffHunk {
    const oldLinesWithSegments: DiffLineWithSegments[] = []
    const newLinesWithSegments: DiffLineWithSegments[] = []

    if (hunk.oldLines.length === hunk.newLines.length) {
      // Equal count: pair lines by index for word-level intraline diff
      for (let i = 0; i < hunk.oldLines.length; i++) {
        const { oldSegments, newSegments } = this.computeLineSegments(hunk.oldLines[i], hunk.newLines[i])
        oldLinesWithSegments.push(oldSegments)
        newLinesWithSegments.push(newSegments)
      }
    } else {
      // Unequal count: character-level diff on the joined blocks.
      // This correctly handles line merges/splits and blank-line removal/insertion —
      // the most common source of "entire block is bright red" artifacts.
      // Equal text within the blocks gets 'equal' segments, so lines whose content
      // didn't actually change won't receive intraline highlighting.
      const oldText = hunk.oldLines.join('\n')
      const newText = hunk.newLines.join('\n')
      const charChanges = diffChars(oldText, newText)

      const oldSegs: DiffSegment[] = []
      const newSegs: DiffSegment[] = []

      for (const change of charChanges) {
        if (change.removed) {
          oldSegs.push({ type: 'removed', text: change.value })
        } else if (change.added) {
          newSegs.push({ type: 'added', text: change.value })
        } else {
          oldSegs.push({ type: 'equal', text: change.value })
          newSegs.push({ type: 'equal', text: change.value })
        }
      }

      oldLinesWithSegments.push(...this.splitByNewlines(oldSegs, hunk.oldLines))
      newLinesWithSegments.push(...this.splitByNewlines(newSegs, hunk.newLines))
    }

    return {
      id: uuid(),
      oldStart: hunk.oldStart,
      oldLines: hunk.oldLines,
      oldLinesWithSegments,
      newStart: hunk.newStart,
      newLines: hunk.newLines,
      newLinesWithSegments,
      accepted: null,
    }
  }

  computeHunks(original: string, modified: string): DiffHunk[] {
    // Normalize line endings before diff to prevent CRLF/LF false positives
    // where a model returns \r\n and the editor stores \n (or vice versa).
    const orig = original.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    const mod = modified.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

    const changes = diffLines(orig, mod)
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
          currentHunk = { oldStart: oldLine, oldLines: [], newStart: newLine, newLines: [] }
        }
        currentHunk.newLines.push(...lines)
        newLine += lines.length
      } else if (change.removed) {
        if (!currentHunk) {
          currentHunk = { oldStart: oldLine, oldLines: [], newStart: newLine, newLines: [] }
        }
        currentHunk.oldLines.push(...lines)
        oldLine += lines.length
      } else {
        if (currentHunk) {
          hunks.push(this.buildHunk(currentHunk))
          currentHunk = null
        }
        oldLine += lines.length
        newLine += lines.length
      }
    }

    if (currentHunk) {
      hunks.push(this.buildHunk(currentHunk))
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
