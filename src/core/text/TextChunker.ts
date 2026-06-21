export interface TextChunk {
  text: string
  start: number
  end: number
}

export class TextChunker {
  split(text: string, maxSize: number): TextChunk[] {
    if (maxSize <= 0 || text.length <= maxSize) {
      return [{ text, start: 0, end: text.length }]
    }

    const parts = this.splitAtParagraphs(text)
    const chunks = this.groupIntoBoundedChunks(text, parts, maxSize)
    return chunks.length > 0 ? chunks : [{ text, start: 0, end: text.length }]
  }

  private splitAtParagraphs(text: string): Array<{ start: number; end: number }> {
    const parts: Array<{ start: number; end: number }> = []
    let pos = 0
    const re = /\n\n+/g
    let m: RegExpExecArray | null

    while ((m = re.exec(text)) !== null) {
      const boundaryEnd = m.index + m[0].length
      parts.push({ start: pos, end: boundaryEnd })
      pos = boundaryEnd
    }

    if (pos < text.length) {
      parts.push({ start: pos, end: text.length })
    }

    return parts
  }

  private groupIntoBoundedChunks(
    text: string,
    parts: Array<{ start: number; end: number }>,
    maxSize: number
  ): TextChunk[] {
    const chunks: TextChunk[] = []
    let chunkStart = -1
    let chunkEnd = 0

    for (const part of parts) {
      const partLen = part.end - part.start

      if (chunkStart === -1) {
        chunkStart = part.start
        chunkEnd = part.end
      } else if (chunkEnd - chunkStart + partLen <= maxSize) {
        chunkEnd = part.end
      } else {
        // flush
        if (chunkEnd - chunkStart > maxSize) {
          chunks.push(...this.splitBySize(text, chunkStart, chunkEnd, maxSize))
        } else {
          chunks.push({ text: text.slice(chunkStart, chunkEnd), start: chunkStart, end: chunkEnd })
        }
        chunkStart = part.start
        chunkEnd = part.end
      }
    }

    if (chunkStart !== -1) {
      if (chunkEnd - chunkStart > maxSize) {
        chunks.push(...this.splitBySize(text, chunkStart, chunkEnd, maxSize))
      } else {
        chunks.push({ text: text.slice(chunkStart, chunkEnd), start: chunkStart, end: chunkEnd })
      }
    }

    return chunks
  }

  private splitBySize(text: string, from: number, to: number, maxSize: number): TextChunk[] {
    const chunks: TextChunk[] = []
    let pos = from

    while (pos < to) {
      const end = Math.min(pos + maxSize, to)

      if (end < to) {
        const slice = text.slice(pos, end)
        // Prefer sentence boundary, then word boundary
        const sentBound = slice.lastIndexOf('. ')
        const wordBound = slice.lastIndexOf(' ')
        const boundary =
          sentBound > maxSize / 2
            ? sentBound + 1
            : wordBound > maxSize / 2
              ? wordBound + 1
              : slice.length

        const actualEnd = pos + boundary
        chunks.push({ text: text.slice(pos, actualEnd), start: pos, end: actualEnd })
        pos = actualEnd
      } else {
        chunks.push({ text: text.slice(pos, to), start: pos, end: to })
        pos = to
      }
    }

    return chunks
  }
}
